/**
 * Integration tests for delegation enforcer
 * Tests the entire flow from hook input to modified output
 *
 * NOTE: These tests are SKIPPED because the delegation enforcer is not yet wired
 * into the hooks bridge. The enforcer module exists but processHook() doesn't
 * call it. These tests will be enabled once the integration is implemented.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processHook } from '../hooks/bridge.js';
describe.skip('delegation-enforcer integration', () => {
    let originalDebugEnv;
    beforeEach(() => {
        originalDebugEnv = process.env.OMG_DEBUG;
    });
    afterEach(() => {
        if (originalDebugEnv === undefined) {
            delete process.env.OMG_DEBUG;
        }
        else {
            process.env.OMG_DEBUG = originalDebugEnv;
        }
    });
    describe('pre-tool-use hook with Task calls', () => {
        it('injects model parameter for Task call without model', async () => {
            const input = {
                toolName: 'Task',
                toolInput: {
                    description: 'Test task',
                    prompt: 'Do something',
                    subagent_type: 'oh-my-gemini:executor'
                }
            };
            const result = await processHook('pre-tool-use', input);
            expect(result.continue).toBe(true);
            expect(result.modifiedInput).toBeDefined();
            const modifiedInput = result.modifiedInput;
            expect(modifiedInput.model).toBe('pro');
            expect(modifiedInput.description).toBe('Test task');
            expect(modifiedInput.prompt).toBe('Do something');
        });
        it('preserves explicit model parameter', async () => {
            const input = {
                toolName: 'Task',
                toolInput: {
                    description: 'Test task',
                    prompt: 'Do something',
                    subagent_type: 'oh-my-gemini:executor',
                    model: 'flash'
                }
            };
            const result = await processHook('pre-tool-use', input);
            expect(result.continue).toBe(true);
            expect(result.modifiedInput).toBeDefined();
            const modifiedInput = result.modifiedInput;
            expect(modifiedInput.model).toBe('flash');
        });
        it('handles Agent tool name', async () => {
            const input = {
                toolName: 'Agent',
                toolInput: {
                    description: 'Test task',
                    prompt: 'Do something',
                    subagent_type: 'executor-low'
                }
            };
            const result = await processHook('pre-tool-use', input);
            expect(result.continue).toBe(true);
            const modifiedInput = result.modifiedInput;
            expect(modifiedInput.model).toBe('flash');
        });
        it('does not modify non-agent tools', async () => {
            const input = {
                toolName: 'Bash',
                toolInput: {
                    command: 'ls -la'
                }
            };
            const result = await processHook('pre-tool-use', input);
            expect(result.continue).toBe(true);
            const modifiedInput = result.modifiedInput;
            expect(modifiedInput.command).toBe('ls -la');
            expect(modifiedInput).not.toHaveProperty('model');
        });
        it('works with all agent tiers', async () => {
            const testCases = [
                { agent: 'architect', expectedModel: 'ultra' },
                { agent: 'architect-low', expectedModel: 'flash' },
                { agent: 'executor-high', expectedModel: 'ultra' },
                { agent: 'executor-low', expectedModel: 'flash' },
                { agent: 'designer-high', expectedModel: 'ultra' }
            ];
            for (const testCase of testCases) {
                const input = {
                    toolName: 'Task',
                    toolInput: {
                        description: 'Test',
                        prompt: 'Test',
                        subagent_type: testCase.agent
                    }
                };
                const result = await processHook('pre-tool-use', input);
                const modifiedInput = result.modifiedInput;
                expect(modifiedInput.model).toBe(testCase.expectedModel);
            }
        });
        it('does not log warning when OMG_DEBUG not set', async () => {
            delete process.env.OMG_DEBUG;
            const consoleWarnSpy = vi.spyOn(console, 'warn');
            const input = {
                toolName: 'Task',
                toolInput: {
                    description: 'Test',
                    prompt: 'Test',
                    subagent_type: 'executor'
                }
            };
            await processHook('pre-tool-use', input);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });
        it('logs warning when OMG_DEBUG=true', async () => {
            process.env.OMG_DEBUG = 'true';
            const consoleWarnSpy = vi.spyOn(console, 'warn');
            const input = {
                toolName: 'Task',
                toolInput: {
                    description: 'Test',
                    prompt: 'Test',
                    subagent_type: 'executor'
                }
            };
            await processHook('pre-tool-use', input);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[OMG] Auto-injecting model'));
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('pro'));
            consoleWarnSpy.mockRestore();
        });
    });
});
//# sourceMappingURL=delegation-enforcer-integration.test.js.map