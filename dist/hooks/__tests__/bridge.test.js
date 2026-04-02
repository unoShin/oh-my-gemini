import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processHook, resetSkipHooksCache } from '../bridge.js';
describe('processHook - Environment Kill-Switches', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        // Reset environment and cache before each test
        process.env = { ...originalEnv };
        delete process.env.DISABLE_OMG;
        delete process.env.OMG_SKIP_HOOKS;
        resetSkipHooksCache();
    });
    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
        resetSkipHooksCache();
    });
    describe('DISABLE_OMG flag', () => {
        it('should return continue:true when DISABLE_OMG=1', async () => {
            process.env.DISABLE_OMG = '1';
            const input = {
                sessionId: 'test-session',
                prompt: 'test prompt',
                directory: '/tmp/test'
            };
            const result = await processHook('keyword-detector', input);
            expect(result).toEqual({ continue: true });
        });
        it('should return continue:true when DISABLE_OMG=true (string)', async () => {
            process.env.DISABLE_OMG = 'true';
            const input = {
                sessionId: 'test-session',
                prompt: 'test prompt',
                directory: '/tmp/test'
            };
            const result = await processHook('persistent-mode', input);
            expect(result).toEqual({ continue: true });
        });
        it('should process normally when DISABLE_OMG is not set', async () => {
            const input = {
                sessionId: 'test-session',
                prompt: 'hello world',
                directory: '/tmp/test'
            };
            const result = await processHook('keyword-detector', input);
            // Should process normally (keyword-detector returns continue:true for non-keyword prompts)
            expect(result.continue).toBe(true);
            // No message because 'hello world' doesn't contain keywords
        });
        it('should process normally when DISABLE_OMG=false', async () => {
            process.env.DISABLE_OMG = 'false';
            const input = {
                sessionId: 'test-session',
                prompt: 'hello world',
                directory: '/tmp/test'
            };
            const result = await processHook('keyword-detector', input);
            // Should process normally (not disabled)
            expect(result.continue).toBe(true);
        });
    });
    describe('OMG_SKIP_HOOKS flag', () => {
        it('should skip single hook type when specified', async () => {
            process.env.OMG_SKIP_HOOKS = 'pre-tool-use';
            const input = {
                sessionId: 'test-session',
                toolName: 'Write',
                toolInput: { file_path: '/test/file.ts', content: 'test' },
                directory: '/tmp/test'
            };
            const result = await processHook('pre-tool-use', input);
            expect(result).toEqual({ continue: true });
        });
        it('should skip multiple hook types when comma-separated', async () => {
            process.env.OMG_SKIP_HOOKS = 'pre-tool-use,persistent-mode';
            const preToolInput = {
                sessionId: 'test-session',
                toolName: 'Write',
                directory: '/tmp/test'
            };
            const persistentModeInput = {
                sessionId: 'test-session',
                directory: '/tmp/test'
            };
            const preToolResult = await processHook('pre-tool-use', preToolInput);
            const persistentResult = await processHook('persistent-mode', persistentModeInput);
            expect(preToolResult).toEqual({ continue: true });
            expect(persistentResult).toEqual({ continue: true });
        });
        it('should handle whitespace in OMG_SKIP_HOOKS', async () => {
            process.env.OMG_SKIP_HOOKS = ' pre-tool-use , persistent-mode ';
            const input = {
                sessionId: 'test-session',
                toolName: 'Write',
                directory: '/tmp/test'
            };
            const result = await processHook('pre-tool-use', input);
            expect(result).toEqual({ continue: true });
        });
        it('should process normally when hook type is not in skip list', async () => {
            process.env.OMG_SKIP_HOOKS = 'persistent-mode';
            const input = {
                sessionId: 'test-session',
                prompt: 'hello world',
                directory: '/tmp/test'
            };
            const result = await processHook('keyword-detector', input);
            // Should process normally (keyword-detector not in skip list)
            expect(result.continue).toBe(true);
        });
        it('should process normally when OMG_SKIP_HOOKS is empty', async () => {
            process.env.OMG_SKIP_HOOKS = '';
            const input = {
                sessionId: 'test-session',
                prompt: 'hello world',
                directory: '/tmp/test'
            };
            const result = await processHook('keyword-detector', input);
            expect(result.continue).toBe(true);
        });
    });
    describe('Combined flags', () => {
        it('should respect DISABLE_OMG even if OMG_SKIP_HOOKS is set', async () => {
            process.env.DISABLE_OMG = '1';
            process.env.OMG_SKIP_HOOKS = 'keyword-detector';
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test'
            };
            const result = await processHook('keyword-detector', input);
            // DISABLE_OMG takes precedence
            expect(result).toEqual({ continue: true });
        });
    });
    describe('Performance', () => {
        it('should have no performance impact when flags are not set', async () => {
            const input = {
                sessionId: 'test-session',
                prompt: 'hello world',
                directory: '/tmp/test'
            };
            const start = Date.now();
            await processHook('keyword-detector', input);
            const duration = Date.now() - start;
            // Should complete in under 100ms (very generous threshold)
            // The actual overhead should be negligible (< 1ms)
            expect(duration).toBeLessThan(100);
        });
        it('should have minimal overhead when DISABLE_OMG=1', async () => {
            process.env.DISABLE_OMG = '1';
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test'
            };
            const start = Date.now();
            await processHook('keyword-detector', input);
            const duration = Date.now() - start;
            // Should be even faster when disabled (immediate return)
            expect(duration).toBeLessThan(50);
        });
    });
    describe('All hook types', () => {
        // Ensure this list stays in sync with HookType.
        // NOTE: `satisfies HookType[]` catches invalid values (typos, removed types),
        // but does NOT enforce exhaustiveness -- if a new HookType variant is added,
        // TypeScript will not error here until a test exercises the missing variant.
        const hookTypes = [
            'keyword-detector',
            'stop-continuation',
            'ralph',
            'persistent-mode',
            'session-start',
            'session-end',
            'pre-tool-use',
            'post-tool-use',
            'autopilot',
            'subagent-start',
            'subagent-stop',
            'pre-compact',
            'setup-init',
            'setup-maintenance',
            'permission-request'
        ];
        it('should disable all hook types when DISABLE_OMG=1', async () => {
            process.env.DISABLE_OMG = '1';
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test'
            };
            for (const hookType of hookTypes) {
                const result = await processHook(hookType, input);
                expect(result).toEqual({ continue: true });
            }
        });
    });
    describe('Bedrock/Vertex model deny on Agent tool (issue #1415)', () => {
        it('should deny Agent calls with model param when forceInherit is enabled', async () => {
            process.env.GEMINI_CODE_USE_BEDROCK = '1';
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test',
                toolName: 'Agent',
                toolInput: {
                    description: 'Test agent',
                    prompt: 'Do something',
                    subagent_type: 'oh-my-gemini:executor',
                    model: 'pro',
                },
            };
            const result = await processHook('pre-tool-use', input);
            expect(result).toHaveProperty('hookSpecificOutput');
            const output = result.hookSpecificOutput;
            expect(output.permissionDecision).toBe('deny');
            expect(output.permissionDecisionReason).toContain('MODEL ROUTING');
            expect(output.permissionDecisionReason).toContain('Agent');
        });
        it('should deny Task calls with model param when forceInherit is enabled', async () => {
            process.env.GEMINI_CODE_USE_BEDROCK = '1';
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test',
                toolName: 'Task',
                toolInput: {
                    description: 'Test task',
                    prompt: 'Do something',
                    subagent_type: 'oh-my-gemini:executor',
                    model: 'ultra',
                },
            };
            const result = await processHook('pre-tool-use', input);
            expect(result).toHaveProperty('hookSpecificOutput');
            const output = result.hookSpecificOutput;
            expect(output.permissionDecision).toBe('deny');
            expect(output.permissionDecisionReason).toContain('MODEL ROUTING');
            expect(output.permissionDecisionReason).toContain('Task');
        });
        it('should allow Agent calls without model param on Bedrock', async () => {
            process.env.GEMINI_CODE_USE_BEDROCK = '1';
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test',
                toolName: 'Agent',
                toolInput: {
                    description: 'Test agent',
                    prompt: 'Do something',
                    subagent_type: 'oh-my-gemini:executor',
                },
            };
            const result = await processHook('pre-tool-use', input);
            const output = result.hookSpecificOutput;
            expect(output?.permissionDecision).not.toBe('deny');
        });
        it('should deny lowercase agent calls with model param when forceInherit is enabled', async () => {
            process.env.GEMINI_CODE_USE_BEDROCK = '1';
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test',
                toolName: 'agent',
                toolInput: {
                    description: 'Test agent',
                    prompt: 'Do something',
                    subagent_type: 'oh-my-gemini:executor',
                    model: 'pro',
                },
            };
            const result = await processHook('pre-tool-use', input);
            expect(result).toHaveProperty('hookSpecificOutput');
            const output = result.hookSpecificOutput;
            expect(output.permissionDecision).toBe('deny');
            expect(output.permissionDecisionReason).toContain('MODEL ROUTING');
        });
    });
    describe('post-tool-use delegation completion handling', () => {
        it.each(['Task', 'Agent'])('should surface verification reminder for %s completions', async (toolName) => {
            const input = {
                sessionId: 'test-session',
                prompt: 'test',
                directory: '/tmp/test',
                toolName,
                toolInput: {
                    description: 'Test agent',
                    prompt: 'Do something',
                    subagent_type: 'oh-my-gemini:executor',
                },
                toolOutput: 'done',
            };
            const result = await processHook('post-tool-use', input);
            expect(result.continue).toBe(true);
            expect(result.message).toContain('MANDATORY VERIFICATION - SUBAGENTS LIE');
            expect(result.message).toContain('done');
        });
    });
});
//# sourceMappingURL=bridge.test.js.map