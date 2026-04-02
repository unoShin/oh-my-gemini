/**
 * Tests for delegation enforcer middleware
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { enforceModel, isAgentCall, processPreToolUse, getModelForAgent } from '../features/delegation-enforcer.js';
import { resolveDelegation } from '../features/delegation-routing/resolver.js';
describe('delegation-enforcer', () => {
    let originalDebugEnv;
    // Save/restore env vars that trigger non-Gemini provider detection (issue #1201)
    // so existing tests run in a standard Gemini environment
    const providerEnvKeys = ['ANTHROPIC_BASE_URL', 'GEMINI_MODEL', 'ANTHROPIC_MODEL', 'OMG_ROUTING_FORCE_INHERIT', 'GEMINI_CODE_USE_BEDROCK', 'GEMINI_CODE_USE_VERTEX', 'GEMINI_CODE_BEDROCK_ULTRA_MODEL', 'GEMINI_CODE_BEDROCK_PRO_MODEL', 'GEMINI_CODE_BEDROCK_FLASH_MODEL', 'ANTHROPIC_DEFAULT_ULTRA_MODEL', 'ANTHROPIC_DEFAULT_PRO_MODEL', 'ANTHROPIC_DEFAULT_FLASH_MODEL', 'OMG_MODEL_HIGH', 'OMG_MODEL_MEDIUM', 'OMG_MODEL_LOW'];
    const savedProviderEnv = {};
    beforeEach(() => {
        originalDebugEnv = process.env.OMG_DEBUG;
        for (const key of providerEnvKeys) {
            savedProviderEnv[key] = process.env[key];
            delete process.env[key];
        }
    });
    afterEach(() => {
        if (originalDebugEnv === undefined) {
            delete process.env.OMG_DEBUG;
        }
        else {
            process.env.OMG_DEBUG = originalDebugEnv;
        }
        for (const key of providerEnvKeys) {
            if (savedProviderEnv[key] === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = savedProviderEnv[key];
            }
        }
    });
    describe('enforceModel', () => {
        it('preserves explicitly specified model (already an alias)', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:executor',
                model: 'flash'
            };
            const result = enforceModel(input);
            expect(result.injected).toBe(false);
            expect(result.modifiedInput.model).toBe('flash');
        });
        it('normalizes explicit full model ID to CC alias (issue #1415)', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:executor',
                model: 'gemini-pro-4-6'
            };
            const result = enforceModel(input);
            expect(result.injected).toBe(false);
            expect(result.modifiedInput.model).toBe('pro');
        });
        it('normalizes explicit Bedrock model ID to CC alias (issue #1415)', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:executor',
                model: 'us.anthropic.gemini-pro-4-6-v1:0'
            };
            const result = enforceModel(input);
            expect(result.injected).toBe(false);
            expect(result.modifiedInput.model).toBe('pro');
        });
        it('injects model from agent definition when not specified', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:executor'
            };
            const result = enforceModel(input);
            expect(result.injected).toBe(true);
            expect(result.modifiedInput.model).toBe('pro'); // executor defaults to gemini-pro-4-6
            expect(result.originalInput.model).toBeUndefined();
        });
        it('handles agent type without prefix', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'debugger'
            };
            const result = enforceModel(input);
            expect(result.injected).toBe(true);
            expect(result.modifiedInput.model).toBe('pro'); // debugger defaults to gemini-pro-4-6
        });
        it('rewrites deprecated aliases to canonical agent names before injecting model', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:build-fixer'
            };
            const result = enforceModel(input);
            expect(result.injected).toBe(true);
            expect(result.modifiedInput.subagent_type).toBe('oh-my-gemini:debugger');
            expect(result.modifiedInput.model).toBe('pro');
        });
        it('throws error for unknown agent type', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'unknown-agent'
            };
            expect(() => enforceModel(input)).toThrow('Unknown agent type');
        });
        it('logs warning only when OMG_DEBUG=true', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'executor'
            };
            // Without debug flag
            delete process.env.OMG_DEBUG;
            const resultWithoutDebug = enforceModel(input);
            expect(resultWithoutDebug.warning).toBeUndefined();
            // With debug flag
            process.env.OMG_DEBUG = 'true';
            const resultWithDebug = enforceModel(input);
            expect(resultWithDebug.warning).toBeDefined();
            expect(resultWithDebug.warning).toContain('Auto-injecting model');
            expect(resultWithDebug.warning).toContain('gemini-pro-4-6');
            expect(resultWithDebug.warning).toContain('executor');
        });
        it('does not log warning when OMG_DEBUG is false', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'executor'
            };
            process.env.OMG_DEBUG = 'false';
            const result = enforceModel(input);
            expect(result.warning).toBeUndefined();
        });
        it('works with all agents', () => {
            const testCases = [
                { agent: 'architect', expectedModel: 'ultra' },
                { agent: 'executor', expectedModel: 'pro' },
                { agent: 'explore', expectedModel: 'flash' },
                { agent: 'designer', expectedModel: 'pro' },
                { agent: 'debugger', expectedModel: 'pro' },
                { agent: 'verifier', expectedModel: 'pro' },
                { agent: 'code-reviewer', expectedModel: 'ultra' },
                { agent: 'test-engineer', expectedModel: 'pro' }
            ];
            for (const testCase of testCases) {
                const input = {
                    description: 'Test',
                    prompt: 'Test',
                    subagent_type: testCase.agent
                };
                const result = enforceModel(input);
                expect(result.modifiedInput.model).toBe(testCase.expectedModel);
                expect(result.injected).toBe(true);
            }
        });
    });
    describe('isAgentCall', () => {
        it('returns true for Agent tool with valid input', () => {
            const toolInput = {
                description: 'Test',
                prompt: 'Test',
                subagent_type: 'executor'
            };
            expect(isAgentCall('Agent', toolInput)).toBe(true);
        });
        it('returns true for Task tool with valid input', () => {
            const toolInput = {
                description: 'Test',
                prompt: 'Test',
                subagent_type: 'executor'
            };
            expect(isAgentCall('Task', toolInput)).toBe(true);
        });
        it('returns false for non-agent tools', () => {
            const toolInput = {
                description: 'Test',
                prompt: 'Test',
                subagent_type: 'executor'
            };
            expect(isAgentCall('Bash', toolInput)).toBe(false);
            expect(isAgentCall('Read', toolInput)).toBe(false);
        });
        it('returns false for invalid input structure', () => {
            expect(isAgentCall('Agent', null)).toBe(false);
            expect(isAgentCall('Agent', undefined)).toBe(false);
            expect(isAgentCall('Agent', 'string')).toBe(false);
            expect(isAgentCall('Agent', { description: 'test' })).toBe(false); // missing prompt
            expect(isAgentCall('Agent', { prompt: 'test' })).toBe(false); // missing description
        });
    });
    describe('processPreToolUse', () => {
        it('returns original input for non-agent tools', () => {
            const toolInput = { command: 'ls -la' };
            const result = processPreToolUse('Bash', toolInput);
            expect(result.modifiedInput).toEqual(toolInput);
            expect(result.warning).toBeUndefined();
        });
        it('rewrites deprecated aliases in pre-tool-use enforcement even when model is explicit', () => {
            const toolInput = {
                description: 'Test',
                prompt: 'Test',
                subagent_type: 'quality-reviewer',
                model: 'ultra'
            };
            const result = processPreToolUse('Task', toolInput);
            expect(result.modifiedInput).toEqual({
                ...toolInput,
                subagent_type: 'code-reviewer',
            });
        });
        it('enforces model for agent calls', () => {
            const toolInput = {
                description: 'Test',
                prompt: 'Test',
                subagent_type: 'executor'
            };
            const result = processPreToolUse('Agent', toolInput);
            expect(result.modifiedInput).toHaveProperty('model', 'pro');
        });
        it('does not modify input when model already specified', () => {
            const toolInput = {
                description: 'Test',
                prompt: 'Test',
                subagent_type: 'executor',
                model: 'flash'
            };
            const result = processPreToolUse('Agent', toolInput);
            expect(result.modifiedInput).toEqual(toolInput);
            expect(result.warning).toBeUndefined();
        });
        it('logs warning only when OMG_DEBUG=true and model injected', () => {
            const toolInput = {
                description: 'Test',
                prompt: 'Test',
                subagent_type: 'executor'
            };
            // Without debug
            delete process.env.OMG_DEBUG;
            const resultWithoutDebug = processPreToolUse('Agent', toolInput);
            expect(resultWithoutDebug.warning).toBeUndefined();
            // With debug
            process.env.OMG_DEBUG = 'true';
            const resultWithDebug = processPreToolUse('Agent', toolInput);
            expect(resultWithDebug.warning).toBeDefined();
        });
    });
    describe('getModelForAgent', () => {
        it('returns correct model for agent with prefix', () => {
            expect(getModelForAgent('oh-my-gemini:executor')).toBe('pro');
            expect(getModelForAgent('oh-my-gemini:debugger')).toBe('pro');
            expect(getModelForAgent('oh-my-gemini:architect')).toBe('ultra');
        });
        it('returns correct model for agent without prefix', () => {
            expect(getModelForAgent('executor')).toBe('pro');
            expect(getModelForAgent('debugger')).toBe('pro');
            expect(getModelForAgent('architect')).toBe('ultra');
            expect(getModelForAgent('build-fixer')).toBe('pro');
        });
        it('throws error for unknown agent', () => {
            expect(() => getModelForAgent('unknown')).toThrow('Unknown agent type');
        });
    });
    describe('deprecated alias routing', () => {
        it('routes api-reviewer to code-reviewer', () => {
            const result = resolveDelegation({ agentRole: 'api-reviewer' });
            expect(result.provider).toBe('gemini');
            expect(result.tool).toBe('Task');
            expect(result.agentOrModel).toBe('code-reviewer');
        });
        it('routes performance-reviewer to code-reviewer', () => {
            const result = resolveDelegation({ agentRole: 'performance-reviewer' });
            expect(result.provider).toBe('gemini');
            expect(result.tool).toBe('Task');
            expect(result.agentOrModel).toBe('code-reviewer');
        });
        it('routes dependency-expert to document-specialist', () => {
            const result = resolveDelegation({ agentRole: 'dependency-expert' });
            expect(result.provider).toBe('gemini');
            expect(result.tool).toBe('Task');
            expect(result.agentOrModel).toBe('document-specialist');
        });
        it('routes quality-strategist to code-reviewer', () => {
            const result = resolveDelegation({ agentRole: 'quality-strategist' });
            expect(result.provider).toBe('gemini');
            expect(result.tool).toBe('Task');
            expect(result.agentOrModel).toBe('code-reviewer');
        });
        it('routes vision to document-specialist', () => {
            const result = resolveDelegation({ agentRole: 'vision' });
            expect(result.provider).toBe('gemini');
            expect(result.tool).toBe('Task');
            expect(result.agentOrModel).toBe('document-specialist');
        });
    });
    describe('env-resolved agent defaults (issue #1415)', () => {
        it('injects Bedrock family env model IDs instead of hardcoded tier aliases', () => {
            process.env.GEMINI_CODE_BEDROCK_PRO_MODEL = 'us.anthropic.gemini-pro-4-6-v1:0';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'executor'
            };
            const result = enforceModel(input);
            expect(result.injected).toBe(true);
            // Even with Bedrock env vars, enforceModel normalizes to CC aliases
            expect(result.model).toBe('pro');
            expect(result.modifiedInput.model).toBe('pro');
        });
        it('getModelForAgent returns normalized CC aliases even with Bedrock env vars', () => {
            process.env.GEMINI_CODE_BEDROCK_ULTRA_MODEL = 'us.anthropic.gemini-ultra-4-6-v1:0';
            expect(getModelForAgent('architect')).toBe('ultra');
        });
    });
    describe('modelAliases config override (issue #1211)', () => {
        const savedEnv = {};
        const aliasEnvKeys = ['OMG_MODEL_ALIAS_FLASH', 'OMG_MODEL_ALIAS_PRO', 'OMG_MODEL_ALIAS_ULTRA'];
        beforeEach(() => {
            for (const key of aliasEnvKeys) {
                savedEnv[key] = process.env[key];
                delete process.env[key];
            }
        });
        afterEach(() => {
            for (const key of aliasEnvKeys) {
                if (savedEnv[key] === undefined) {
                    delete process.env[key];
                }
                else {
                    process.env[key] = savedEnv[key];
                }
            }
        });
        it('remaps flash agents to inherit via env var', () => {
            process.env.OMG_MODEL_ALIAS_FLASH = 'inherit';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'explore' // explore defaults to flash
            };
            const result = enforceModel(input);
            expect(result.model).toBe('inherit');
            expect(result.modifiedInput.model).toBeUndefined();
        });
        it('remaps flash agents to pro via env var', () => {
            process.env.OMG_MODEL_ALIAS_FLASH = 'pro';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'explore' // explore defaults to flash
            };
            const result = enforceModel(input);
            expect(result.model).toBe('pro');
            expect(result.modifiedInput.model).toBe('pro');
        });
        it('does not remap when no alias configured for the tier', () => {
            process.env.OMG_MODEL_ALIAS_FLASH = 'pro';
            // executor defaults to pro — no alias for pro
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'executor'
            };
            const result = enforceModel(input);
            expect(result.model).toBe('pro');
            expect(result.modifiedInput.model).toBe('pro');
        });
        it('explicit model param takes priority over alias', () => {
            process.env.OMG_MODEL_ALIAS_FLASH = 'pro';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'explore',
                model: 'ultra' // explicit param wins
            };
            const result = enforceModel(input);
            expect(result.model).toBe('ultra');
            expect(result.modifiedInput.model).toBe('ultra');
        });
        it('forceInherit takes priority over alias', () => {
            process.env.OMG_ROUTING_FORCE_INHERIT = 'true';
            process.env.OMG_MODEL_ALIAS_FLASH = 'pro';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'explore'
            };
            const result = enforceModel(input);
            expect(result.model).toBe('inherit');
            expect(result.modifiedInput.model).toBeUndefined();
        });
        it('remaps ultra agents to inherit via env var', () => {
            process.env.OMG_MODEL_ALIAS_ULTRA = 'inherit';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'architect' // architect defaults to ultra
            };
            const result = enforceModel(input);
            expect(result.model).toBe('inherit');
            expect(result.modifiedInput.model).toBeUndefined();
        });
        it('includes alias note in debug warning', () => {
            process.env.OMG_MODEL_ALIAS_FLASH = 'pro';
            process.env.OMG_DEBUG = 'true';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'explore'
            };
            const result = enforceModel(input);
            expect(result.warning).toContain('aliased from flash');
        });
    });
    describe('non-Gemini provider support (issue #1201)', () => {
        const savedEnv = {};
        const envKeys = ['GEMINI_MODEL', 'ANTHROPIC_BASE_URL', 'OMG_ROUTING_FORCE_INHERIT'];
        beforeEach(() => {
            for (const key of envKeys) {
                savedEnv[key] = process.env[key];
                delete process.env[key];
            }
        });
        afterEach(() => {
            for (const key of envKeys) {
                if (savedEnv[key] === undefined) {
                    delete process.env[key];
                }
                else {
                    process.env[key] = savedEnv[key];
                }
            }
        });
        it('strips model when Bedrock ARN auto-enables forceInherit', () => {
            process.env.ANTHROPIC_MODEL = 'arn:aws:bedrock:us-east-2:123456789012:inference-profile/global.anthropic.gemini-ultra-4-6-v1:0';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:executor',
                model: 'pro'
            };
            const result = enforceModel(input);
            expect(result.model).toBe('inherit');
            expect(result.modifiedInput.model).toBeUndefined();
        });
        it('strips model when non-Gemini provider auto-enables forceInherit', () => {
            process.env.GEMINI_MODEL = 'glm-5';
            // forceInherit is auto-enabled by loadConfig for non-Gemini providers
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:executor',
                model: 'pro'
            };
            const result = enforceModel(input);
            expect(result.model).toBe('inherit');
            expect(result.modifiedInput.model).toBeUndefined();
        });
        it('strips model when custom ANTHROPIC_BASE_URL auto-enables forceInherit', () => {
            process.env.ANTHROPIC_BASE_URL = 'https://my-proxy.example.com/v1';
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:architect',
                model: 'ultra'
            };
            const result = enforceModel(input);
            expect(result.model).toBe('inherit');
            expect(result.modifiedInput.model).toBeUndefined();
        });
        it('does not strip model for standard Gemini setup', () => {
            const input = {
                description: 'Test task',
                prompt: 'Do something',
                subagent_type: 'oh-my-gemini:executor',
                model: 'flash'
            };
            const result = enforceModel(input);
            expect(result.model).toBe('flash');
            expect(result.modifiedInput.model).toBe('flash');
        });
    });
});
//# sourceMappingURL=delegation-enforcer.test.js.map