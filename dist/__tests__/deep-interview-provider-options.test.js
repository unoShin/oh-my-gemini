import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const availability = vi.hoisted(() => ({
    gemini: true,
}));
vi.mock('../team/model-contract.js', () => ({
    isCliAvailable: (agentType) => availability[agentType],
}));
import { clearSkillsCache, getBuiltinSkill } from '../features/builtin-skills/skills.js';
import { renderSkillRuntimeGuidance } from '../features/builtin-skills/runtime-guidance.js';
describe('deep-interview provider-aware execution recommendations', () => {
    const originalPluginRoot = process.env.GEMINI_PLUGIN_ROOT;
    const originalPath = process.env.PATH;
    beforeEach(() => {
        availability.gemini = true;
        if (originalPluginRoot === undefined) {
            delete process.env.GEMINI_PLUGIN_ROOT;
        }
        else {
            process.env.GEMINI_PLUGIN_ROOT = originalPluginRoot;
        }
        if (originalPath === undefined) {
            delete process.env.PATH;
        }
        else {
            process.env.PATH = originalPath;
        }
        clearSkillsCache();
    });
    afterEach(() => {
        if (originalPluginRoot === undefined) {
            delete process.env.GEMINI_PLUGIN_ROOT;
        }
        else {
            process.env.GEMINI_PLUGIN_ROOT = originalPluginRoot;
        }
        if (originalPath === undefined) {
            delete process.env.PATH;
        }
        else {
            process.env.PATH = originalPath;
        }
        clearSkillsCache();
    });
    it('injects Gemini variants into the deep-interview template when Gemini CLI is available', () => {
        availability.gemini = true;
        clearSkillsCache();
        const skill = getBuiltinSkill('deep-interview');
        expect(skill?.template).toContain('## Provider-Aware Execution Recommendations');
        expect(skill?.template).toContain('/ralplan --architect gemini');
        expect(skill?.template).toContain('/ralplan --critic gemini');
        expect(skill?.template).toContain('/ralph --critic gemini');
        expect(skill?.template).toContain('higher cost than Gemini-only ralplan');
    });
    it('falls back to the existing Gemini-only defaults when external providers are unavailable', () => {
        const skill = getBuiltinSkill('deep-interview');
        expect(skill?.template).not.toContain('## Provider-Aware Execution Recommendations');
        expect(skill?.template).toContain('Ralplan → Autopilot (Recommended)');
        expect(skill?.template).toContain('Execute with autopilot (skip ralplan)');
        expect(skill?.template).toContain('Execute with ralph');
    });
    it('documents supported Gemini architect/critic overrides for consensus planning', () => {
        const planSkill = getBuiltinSkill('omg-plan');
        const ralplanSkill = getBuiltinSkill('ralplan');
        expect(planSkill?.template).toContain('--architect gemini');
        expect(planSkill?.template).toContain('ask gemini --agent-prompt architect');
        expect(planSkill?.template).toContain('--critic gemini');
        expect(planSkill?.template).toContain('ask gemini --agent-prompt critic');
        expect(ralplanSkill?.template).toContain('--architect gemini');
        expect(ralplanSkill?.template).toContain('--critic gemini');
    });
    it('renders no extra runtime guidance when no provider-specific deep-interview variant is available', () => {
        expect(renderSkillRuntimeGuidance('deep-interview')).toBe('');
    });
});
//# sourceMappingURL=deep-interview-provider-options.test.js.map