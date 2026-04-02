import { describe, it, expect } from 'vitest';
import { render } from '../../hud/render.js';
import { DEFAULT_HUD_CONFIG } from '../../hud/types.js';
function createMinimalContext(overrides = {}) {
    return {
        contextPercent: 30,
        modelName: 'gemini-pro-4.6',
        ralph: null,
        ultrawork: null,
        prd: null,
        autopilot: null,
        activeAgents: [],
        todos: [],
        backgroundTasks: [],
        cwd: '/tmp/test',
        lastSkill: null,
        rateLimitsResult: null,
        customBuckets: null,
        pendingPermission: null,
        thinkingState: null,
        sessionHealth: null,
        omgVersion: null,
        updateAvailable: null,
        toolCallCount: 0,
        agentCallCount: 0,
        skillCallCount: 0,
        promptTime: null,
        apiKeySource: null,
        profileName: null,
        sessionSummary: null,
        ...overrides,
    };
}
function createMinimalConfig(overrides = {}) {
    return {
        ...DEFAULT_HUD_CONFIG,
        elements: {
            ...DEFAULT_HUD_CONFIG.elements,
            omgLabel: true,
            rateLimits: false,
            ralph: false,
            autopilot: false,
            prdStory: false,
            activeSkills: false,
            lastSkill: false,
            contextBar: false,
            agents: false,
            backgroundTasks: false,
            todos: false,
            permissionStatus: false,
            thinking: false,
            sessionHealth: false,
            ...overrides,
        },
    };
}
describe('HUD version display and update notification', () => {
    describe('OMG label without version', () => {
        it('renders [OMG] when omgVersion is null', async () => {
            const ctx = createMinimalContext({ omgVersion: null });
            const config = createMinimalConfig();
            const output = await render(ctx, config);
            expect(output).toContain('[OMG]');
            expect(output).not.toContain('#');
        });
    });
    describe('OMG label with version', () => {
        it('renders [OMG#X.Y.Z] when omgVersion is set', async () => {
            const ctx = createMinimalContext({ omgVersion: '4.1.10' });
            const config = createMinimalConfig();
            const output = await render(ctx, config);
            expect(output).toContain('[OMG#4.1.10]');
        });
        it('renders version without update notice when updateAvailable is null', async () => {
            const ctx = createMinimalContext({ omgVersion: '4.1.10', updateAvailable: null });
            const config = createMinimalConfig();
            const output = await render(ctx, config);
            expect(output).toContain('[OMG#4.1.10]');
            expect(output).not.toContain('->');
            expect(output).not.toContain('omg update');
        });
    });
    describe('update notification', () => {
        it('renders update notification when updateAvailable is set', async () => {
            const ctx = createMinimalContext({ omgVersion: '4.1.10', updateAvailable: '4.2.0' });
            const config = createMinimalConfig();
            const output = await render(ctx, config);
            expect(output).toContain('[OMG#4.1.10]');
            expect(output).toContain('-> 4.2.0');
            expect(output).toContain('omg update');
        });
        it('renders update notification without version when omgVersion is null', async () => {
            const ctx = createMinimalContext({ omgVersion: null, updateAvailable: '4.2.0' });
            const config = createMinimalConfig();
            const output = await render(ctx, config);
            expect(output).toContain('[OMG]');
            expect(output).toContain('-> 4.2.0');
        });
    });
    describe('omgLabel disabled', () => {
        it('does not render OMG label when omgLabel is false', async () => {
            const ctx = createMinimalContext({ omgVersion: '4.1.10', updateAvailable: '4.2.0' });
            const config = createMinimalConfig({ omgLabel: false });
            const output = await render(ctx, config);
            expect(output).not.toContain('[OMG');
            expect(output).not.toContain('omg update');
        });
    });
});
//# sourceMappingURL=version-display.test.js.map