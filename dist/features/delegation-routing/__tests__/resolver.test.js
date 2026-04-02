import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveDelegation, parseFallbackChain } from '../resolver.js';
describe('resolveDelegation', () => {
    let consoleWarnSpy;
    beforeEach(() => {
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    });
    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });
    // Test 2: Config roles with deprecated gemini provider fall back to gemini
    it('should fall back to gemini when configured route uses deprecated gemini provider', () => {
        const result = resolveDelegation({
            agentRole: 'explore',
            config: {
                enabled: true,
                roles: { explore: { provider: 'gemini', tool: 'Task', model: 'gemini-3-flash' } }
            }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('gemini-3-flash');
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });
    // Test 3: Disabled routing falls back to defaults
    it('should use default when routing is disabled', () => {
        const result = resolveDelegation({
            agentRole: 'explore',
            config: { enabled: false, roles: { explore: { provider: 'gemini', tool: 'Task', model: 'flash' } } }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
    });
    // Test 4: Unknown roles with deprecated gemini defaultProvider fall back to gemini
    it('should handle unknown roles with deprecated gemini defaultProvider by falling back to gemini', () => {
        const result = resolveDelegation({
            agentRole: 'unknown-role',
            config: { enabled: true, defaultProvider: 'gemini' }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('unknown-role');
        expect(result.reason).toContain('Fallback to Gemini Task');
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });
    // Test 5: Empty config uses defaults
    it('should use defaults when config is empty', () => {
        const result = resolveDelegation({ agentRole: 'architect' });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('architect');
    });
    // Test 10: Explicit Task tool
    it('should resolve Task explicit tool', () => {
        const result = resolveDelegation({
            agentRole: 'architect',
            explicitTool: 'Task'
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('architect');
    });
    // Test 12: Role with default mapping uses Gemini subagent
    it('should use default heuristic for mapped roles', () => {
        const result = resolveDelegation({
            agentRole: 'executor',
            config: { enabled: true, roles: {} }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('executor');
        expect(result.reason).toContain('Default heuristic');
    });
    // Test 12: Config with agentType instead of model
    it('should use agentType when model is not specified', () => {
        const result = resolveDelegation({
            agentRole: 'custom-role',
            config: {
                enabled: true,
                roles: {
                    'custom-role': { provider: 'gemini', tool: 'Task', agentType: 'explore' }
                }
            }
        });
        expect(result.agentOrModel).toBe('explore');
    });
    // Test 13: Config with deprecated gemini provider falls back to gemini but preserves fallback chain
    it('should fall back to gemini for deprecated gemini route but preserve fallback chain', () => {
        const result = resolveDelegation({
            agentRole: 'explore',
            config: {
                enabled: true,
                roles: {
                    explore: {
                        provider: 'gemini',
                        tool: 'Task',
                        model: 'gemini-2.5-pro',
                        fallback: ['gemini:explore', 'gemini:gpt-5']
                    }
                }
            }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('gemini-2.5-pro');
        expect(result.reason).toContain('Configured routing');
        expect(result.reason).toContain('deprecated');
        expect(result.fallbackChain).toEqual(['gemini:explore', 'gemini:gpt-5']);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });
    // Test 14: defaultProvider set to gemini falls back to gemini (deprecated)
    it('should fall back to gemini when deprecated gemini defaultProvider is configured', () => {
        const result = resolveDelegation({
            agentRole: 'unknown-role',
            config: { enabled: true, defaultProvider: 'gemini' }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('unknown-role');
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });
    // Test 15: Config enabled but role not in roles map
    it('should fallback to defaults when role not in config roles', () => {
        const result = resolveDelegation({
            agentRole: 'nonexistent-role',
            config: {
                enabled: true,
                roles: { explore: { provider: 'gemini', tool: 'Task', model: 'flash' } }
            }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('nonexistent-role');
        expect(result.reason).toContain('Fallback to Gemini Task');
    });
    // Test 16: Config explicitly enabled undefined (should be treated as disabled)
    it('should treat undefined enabled as disabled', () => {
        const result = resolveDelegation({
            agentRole: 'explore',
            config: {
                roles: { explore: { provider: 'gemini', tool: 'Task', model: 'flash' } }
            }
        });
        // When enabled is undefined, isDelegationEnabled returns false
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('explore');
        expect(result.reason).toContain('Default heuristic');
    });
    // Test 17: Empty roles object with enabled true
    it('should use defaults when roles object is empty', () => {
        const result = resolveDelegation({
            agentRole: 'architect',
            config: { enabled: true, roles: {} }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('architect');
        expect(result.reason).toContain('Default heuristic');
    });
    // Test 18: All known role categories use defaults correctly
    it.each([
        ['explore', 'explore'],
        ['document-specialist', 'document-specialist'],
        ['researcher', 'document-specialist'],
        ['tdd-guide', 'test-engineer'],
        ['architect', 'architect'],
        ['planner', 'planner'],
        ['critic', 'critic'],
        ['analyst', 'analyst'],
        ['executor', 'executor'],
        ['deep-executor', 'executor'],
        ['code-reviewer', 'code-reviewer'],
        ['security-reviewer', 'security-reviewer'],
        ['quality-reviewer', 'code-reviewer'],
        ['designer', 'designer'],
        ['writer', 'writer'],
        ['vision', 'document-specialist'],
        ['qa-tester', 'qa-tester'],
        ['debugger', 'debugger'],
        ['scientist', 'scientist'],
        ['build-fixer', 'debugger'],
        ['harsh-critic', 'critic'],
    ])('should map role %s to default agent %s', (role, expectedAgent) => {
        const result = resolveDelegation({ agentRole: role });
        expect(result.agentOrModel).toBe(expectedAgent);
        expect(result.provider).toBe('gemini');
    });
    // Test 19: Undefined config
    it('should handle undefined config gracefully', () => {
        const result = resolveDelegation({
            agentRole: 'explore',
            config: undefined
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
    });
    // Test 20: Config with model and agentType - model takes precedence
    it('should prefer model over agentType when both specified', () => {
        const result = resolveDelegation({
            agentRole: 'custom-role',
            config: {
                enabled: true,
                roles: {
                    'custom-role': {
                        provider: 'gemini',
                        tool: 'Task',
                        model: 'custom-model',
                        agentType: 'explore'
                    }
                }
            }
        });
        expect(result.agentOrModel).toBe('custom-model');
    });
    // Test: Unknown role + defaultProvider: 'gemini' falls back to gemini (deprecated)
    it('should handle unknown role with gemini defaultProvider by falling back to gemini', () => {
        const result = resolveDelegation({
            agentRole: 'totally-unknown-role',
            config: { enabled: true, defaultProvider: 'gemini' }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('totally-unknown-role');
        expect(result.reason).toContain('Fallback to Gemini Task');
        expect(result.fallbackChain).toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });
    // Test: Unknown role + defaultProvider: 'gemini' falls back to gemini (deprecated)
    it('should handle unknown role with gemini defaultProvider by falling back to gemini', () => {
        const result = resolveDelegation({
            agentRole: 'totally-unknown-role',
            config: { enabled: true, defaultProvider: 'gemini' }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('totally-unknown-role');
        expect(result.reason).toContain('Fallback to Gemini Task');
        expect(result.fallbackChain).toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });
    // Test: Unknown role + defaultProvider: 'gemini' (explicit) with full assertion
    it('should handle unknown role with gemini defaultProvider', () => {
        const result = resolveDelegation({
            agentRole: 'totally-unknown-role',
            config: { enabled: true, defaultProvider: 'gemini' }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('totally-unknown-role');
        expect(result.reason).toContain('Fallback to Gemini Task');
        expect(result.fallbackChain).toBeUndefined();
    });
    // Test: Known role + defaultProvider (should use heuristic, not defaultProvider)
    it('should use heuristic for known role even with different defaultProvider', () => {
        const result = resolveDelegation({
            agentRole: 'architect',
            config: { enabled: true, defaultProvider: 'gemini' }
        });
        // architect is in ROLE_CATEGORY_DEFAULTS, so should use Gemini subagent
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
        expect(result.agentOrModel).toBe('architect');
        expect(result.reason).toContain('Default heuristic');
    });
});
describe('parseFallbackChain', () => {
    it('should parse valid fallback strings', () => {
        const result = parseFallbackChain(['gemini:explore', 'gemini:gpt-5']);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'explore' });
        expect(result[1]).toEqual({ provider: 'gemini', agentOrModel: 'gpt-5' });
    });
    it('should return empty array for undefined input', () => {
        expect(parseFallbackChain(undefined)).toEqual([]);
    });
    it('should return empty array for empty array input', () => {
        expect(parseFallbackChain([])).toEqual([]);
    });
    it('should handle fallback strings with multiple colons', () => {
        const result = parseFallbackChain(['gemini:gpt-5.3-gemini', 'gemini:gemini-2.5-pro']);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'gpt-5.3-gemini' });
        expect(result[1]).toEqual({ provider: 'gemini', agentOrModel: 'gemini-2.5-pro' });
    });
    it('should skip invalid entries without colon', () => {
        const result = parseFallbackChain(['gemini:explore', 'invalid-entry', 'gemini:gpt-5']);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'explore' });
        expect(result[1]).toEqual({ provider: 'gemini', agentOrModel: 'gpt-5' });
    });
    it('should skip entries with empty provider', () => {
        const result = parseFallbackChain([':explore', 'gemini:gpt-5']);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'gpt-5' });
    });
    it('should skip entries with empty agent/model', () => {
        const result = parseFallbackChain(['gemini:', 'gemini:gpt-5']);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'gpt-5' });
    });
    it('should handle single valid entry', () => {
        const result = parseFallbackChain(['gemini:gemini-2.5-pro']);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'gemini-2.5-pro' });
    });
    it('should handle all invalid entries', () => {
        const result = parseFallbackChain(['invalid', 'another-invalid', '']);
        expect(result).toEqual([]);
    });
    it('should preserve case sensitivity', () => {
        const result = parseFallbackChain(['Gemini:Explore', 'GEMINI:GPT-5']);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ provider: 'Gemini', agentOrModel: 'Explore' });
        expect(result[1]).toEqual({ provider: 'GEMINI', agentOrModel: 'GPT-5' });
    });
    it('should handle entries with extra whitespace in model name', () => {
        const result = parseFallbackChain(['gemini: explore with spaces']);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'explore with spaces' });
    });
    it('should trim whitespace from fallback entries', () => {
        const result = parseFallbackChain(['  gemini  :  explore  ', '  gemini  :  gpt-5  ']);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ provider: 'gemini', agentOrModel: 'explore' });
        expect(result[1]).toEqual({ provider: 'gemini', agentOrModel: 'gpt-5' });
    });
});
describe('resolveDelegation provider/tool mismatch correction', () => {
    it('should correct provider/tool mismatch', () => {
        // This tests that resolveFromConfig always returns tool: 'Task'
        // even when the config specifies gemini provider (the only valid combo)
        const result = resolveDelegation({
            agentRole: 'test-role',
            config: {
                enabled: true,
                roles: {
                    'test-role': { provider: 'gemini', tool: 'Task', model: 'test' }
                }
            }
        });
        expect(result.provider).toBe('gemini');
        expect(result.tool).toBe('Task');
    });
});
//# sourceMappingURL=resolver.test.js.map