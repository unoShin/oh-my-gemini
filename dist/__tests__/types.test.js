import { describe, it, expect } from 'vitest';
describe('Type Tests', () => {
    describe('ModelType', () => {
        it('should accept valid model types', () => {
            const validTypes = ['pro', 'ultra', 'flash', 'inherit'];
            expect(validTypes).toHaveLength(4);
        });
    });
    describe('AgentConfig', () => {
        it('should create valid agent config', () => {
            const config = {
                name: 'test-agent',
                description: 'A test agent',
                prompt: 'Test prompt',
                tools: ['tool1', 'tool2'],
                model: 'pro',
            };
            expect(config.name).toBe('test-agent');
            expect(config.tools).toHaveLength(2);
            expect(config.model).toBe('pro');
        });
        it('should allow optional model field', () => {
            const config = {
                name: 'test-agent',
                description: 'A test agent',
                prompt: 'Test prompt',
                tools: [],
            };
            expect(config.model).toBeUndefined();
        });
    });
    describe('PluginConfig', () => {
        it('should create valid plugin config with features', () => {
            const config = {
                features: {
                    parallelExecution: true,
                    lspTools: true,
                    astTools: false,
                    continuationEnforcement: true,
                    autoContextInjection: false,
                },
            };
            expect(config.features?.parallelExecution).toBe(true);
            expect(config.features?.astTools).toBe(false);
        });
        it('should support agent configuration', () => {
            const config = {
                agents: {
                    omg: { model: 'gemini-pro' },
                    architect: { model: 'gemini-ultra' },
                    explore: { model: 'gemini-flash' },
                    documentSpecialist: { model: 'gemini-flash' },
                },
            };
            expect(config.agents?.omg?.model).toBe('gemini-pro');
            expect(config.agents?.architect?.model).toBe('gemini-ultra');
        });
        it('should support routing configuration', () => {
            const config = {
                routing: {
                    enabled: true,
                    defaultTier: 'MEDIUM',
                    escalationEnabled: true,
                    maxEscalations: 2,
                    tierModels: {
                        LOW: 'gemini-flash',
                        MEDIUM: 'gemini-pro',
                        HIGH: 'gemini-ultra',
                    },
                },
            };
            expect(config.routing?.enabled).toBe(true);
            expect(config.routing?.defaultTier).toBe('MEDIUM');
            expect(config.routing?.tierModels?.HIGH).toBe('gemini-ultra');
        });
    });
});
//# sourceMappingURL=types.test.js.map