/**
 * Tests for omg update --force-hooks protection (issue #722)
 *
 * Verifies that the hook merge logic in install() correctly:
 *   - merges OMG hooks with existing non-OMG hooks during `omg update` (force=true)
 *   - warns when non-OMG hooks are present
 *   - only fully replaces when --force-hooks is explicitly set
 *
 * Tests exercise isOmgHook() and the merge logic via unit-level helpers
 * to avoid filesystem side-effects.
 */
import { describe, it, expect } from 'vitest';
import { isOmgHook } from '../installer/index.js';
// ---------------------------------------------------------------------------
// Pure merge helper extracted from install() for isolated testing.
// This mirrors exactly the logic in installer/index.ts so that changes
// to the installer are reflected and tested here.
// ---------------------------------------------------------------------------
function mergeEventHooks(existingGroups, newOmgGroups, options) {
    const conflicts = [];
    const logMessages = [];
    const eventType = 'TestEvent';
    const nonOmgGroups = existingGroups.filter(group => group.hooks.some(h => h.type === 'command' && !isOmgHook(h.command)));
    const hasNonOmgHook = nonOmgGroups.length > 0;
    const nonOmgCommand = hasNonOmgHook
        ? nonOmgGroups[0].hooks.find(h => h.type === 'command' && !isOmgHook(h.command))?.command ?? ''
        : '';
    let merged;
    if (options.forceHooks && !options.allowPluginHookRefresh) {
        if (hasNonOmgHook) {
            logMessages.push(`Warning: Overwriting non-OMG ${eventType} hook with --force-hooks: ${nonOmgCommand}`);
            conflicts.push({ eventType, existingCommand: nonOmgCommand });
        }
        merged = newOmgGroups;
        logMessages.push(`Updated ${eventType} hook (--force-hooks)`);
    }
    else if (options.force) {
        merged = [...nonOmgGroups, ...newOmgGroups];
        if (hasNonOmgHook) {
            logMessages.push(`Merged ${eventType} hooks (updated OMG hooks, preserved non-OMG hook: ${nonOmgCommand})`);
            conflicts.push({ eventType, existingCommand: nonOmgCommand });
        }
        else {
            logMessages.push(`Updated ${eventType} hook (--force)`);
        }
    }
    else {
        if (hasNonOmgHook) {
            logMessages.push(`Warning: ${eventType} hook has non-OMG hook. Skipping. Use --force-hooks to override.`);
            conflicts.push({ eventType, existingCommand: nonOmgCommand });
        }
        else {
            logMessages.push(`${eventType} hook already configured, skipping`);
        }
        merged = existingGroups; // unchanged
    }
    return { merged, conflicts, logMessages };
}
// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------
function omgGroup(command) {
    return { hooks: [{ type: 'command', command }] };
}
function userGroup(command) {
    return { hooks: [{ type: 'command', command }] };
}
const OMG_CMD = 'node "$HOME/.gemini/hooks/keyword-detector.mjs"';
const USER_CMD = '/usr/local/bin/my-custom-hook.sh';
const NEW_OMG_CMD = 'node "$HOME/.gemini/hooks/session-start.mjs"';
// ---------------------------------------------------------------------------
// isOmgHook unit tests
// ---------------------------------------------------------------------------
describe('isOmgHook()', () => {
    it('recognises OMG keyword-detector command', () => {
        expect(isOmgHook('node "$HOME/.gemini/hooks/keyword-detector.mjs"')).toBe(true);
    });
    it('recognises OMG session-start command', () => {
        expect(isOmgHook('node "$HOME/.gemini/hooks/session-start.mjs"')).toBe(true);
    });
    it('recognises OMG pre-tool-use command', () => {
        expect(isOmgHook('node "$HOME/.gemini/hooks/pre-tool-use.mjs"')).toBe(true);
    });
    it('recognises OMG post-tool-use command', () => {
        expect(isOmgHook('node "$HOME/.gemini/hooks/post-tool-use.mjs"')).toBe(true);
    });
    it('recognises OMG persistent-mode command', () => {
        expect(isOmgHook('node "$HOME/.gemini/hooks/persistent-mode.mjs"')).toBe(true);
    });
    it('recognises Windows-style OMG path', () => {
        expect(isOmgHook('node "%USERPROFILE%\\.gemini\\hooks\\keyword-detector.mjs"')).toBe(true);
    });
    it('recognises oh-my-gemini in command path', () => {
        expect(isOmgHook('/path/to/oh-my-gemini/hook.mjs')).toBe(true);
    });
    it('recognises omg as a path segment', () => {
        expect(isOmgHook('/usr/local/bin/omg-hook.sh')).toBe(true);
    });
    it('does not recognise a plain user command', () => {
        expect(isOmgHook('/usr/local/bin/my-custom-hook.sh')).toBe(false);
    });
    it('does not recognise a random shell script', () => {
        expect(isOmgHook('bash /home/user/scripts/notify.sh')).toBe(false);
    });
    it('does not match "omg" inside an unrelated word', () => {
        // "nomg" or "omgr" should NOT match the omg path-segment pattern
        expect(isOmgHook('/usr/bin/nomg-thing')).toBe(false);
    });
});
// ---------------------------------------------------------------------------
// Hook merge logic tests
// ---------------------------------------------------------------------------
describe('Hook merge during omg update', () => {
    describe('no force flags — skip behaviour', () => {
        it('skips an already-configured OMG-only event type', () => {
            const existing = [omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged, conflicts, logMessages } = mergeEventHooks(existing, newOmg, {});
            expect(merged).toEqual(existing); // unchanged
            expect(conflicts).toHaveLength(0);
            expect(logMessages[0]).toMatch(/already configured/);
        });
        it('records conflict but does not overwrite when non-OMG hook exists', () => {
            const existing = [userGroup(USER_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged, conflicts, logMessages } = mergeEventHooks(existing, newOmg, {});
            expect(merged).toEqual(existing); // unchanged
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].existingCommand).toBe(USER_CMD);
            expect(logMessages[0]).toMatch(/non-OMG hook/);
            expect(logMessages[0]).toMatch(/--force-hooks/);
        });
    });
    describe('force=true — merge behaviour (omg update path)', () => {
        it('replaces OMG hooks when event type has only OMG hooks', () => {
            const existing = [omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged, conflicts } = mergeEventHooks(existing, newOmg, { force: true });
            // Non-OMG groups: none → merged = newOmg only
            expect(merged).toHaveLength(1);
            expect(merged[0].hooks[0].command).toBe(NEW_OMG_CMD);
            expect(conflicts).toHaveLength(0);
        });
        it('preserves non-OMG hook and adds updated OMG hook', () => {
            const existing = [userGroup(USER_CMD), omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged, conflicts, logMessages } = mergeEventHooks(existing, newOmg, { force: true });
            // non-OMG groups come first, then new OMG groups
            expect(merged).toHaveLength(2);
            expect(merged[0].hooks[0].command).toBe(USER_CMD);
            expect(merged[1].hooks[0].command).toBe(NEW_OMG_CMD);
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].existingCommand).toBe(USER_CMD);
            expect(logMessages[0]).toMatch(/Merged/);
            expect(logMessages[0]).toMatch(/preserved non-OMG hook/);
        });
        it('preserves multiple non-OMG hook groups', () => {
            const userCmd2 = '/usr/local/bin/another-hook.sh';
            const existing = [userGroup(USER_CMD), userGroup(userCmd2), omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged } = mergeEventHooks(existing, newOmg, { force: true });
            expect(merged).toHaveLength(3); // 2 user groups + 1 new OMG group
            expect(merged[0].hooks[0].command).toBe(USER_CMD);
            expect(merged[1].hooks[0].command).toBe(userCmd2);
            expect(merged[2].hooks[0].command).toBe(NEW_OMG_CMD);
        });
        it('does not carry over old OMG hook groups', () => {
            const existing = [omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged } = mergeEventHooks(existing, newOmg, { force: true });
            const commands = merged.flatMap(g => g.hooks.map(h => h.command));
            expect(commands).not.toContain(OMG_CMD);
            expect(commands).toContain(NEW_OMG_CMD);
        });
        it('records a conflict when non-OMG hook is preserved', () => {
            const existing = [userGroup(USER_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { conflicts } = mergeEventHooks(existing, newOmg, { force: true });
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].existingCommand).toBe(USER_CMD);
        });
        it('records no conflict when only OMG hooks existed', () => {
            const existing = [omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { conflicts } = mergeEventHooks(existing, newOmg, { force: true });
            expect(conflicts).toHaveLength(0);
        });
    });
    describe('forceHooks=true — replace-all behaviour', () => {
        it('replaces OMG-only hooks', () => {
            const existing = [omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged, conflicts } = mergeEventHooks(existing, newOmg, { forceHooks: true });
            expect(merged).toEqual(newOmg);
            expect(conflicts).toHaveLength(0);
        });
        it('replaces non-OMG hook and warns', () => {
            const existing = [userGroup(USER_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged, conflicts, logMessages } = mergeEventHooks(existing, newOmg, { forceHooks: true });
            expect(merged).toEqual(newOmg);
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].existingCommand).toBe(USER_CMD);
            expect(logMessages[0]).toMatch(/Overwriting non-OMG/);
            expect(logMessages[0]).toMatch(/--force-hooks/);
        });
        it('replaces mixed hooks entirely', () => {
            const existing = [userGroup(USER_CMD), omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged } = mergeEventHooks(existing, newOmg, { forceHooks: true });
            expect(merged).toHaveLength(1);
            expect(merged[0].hooks[0].command).toBe(NEW_OMG_CMD);
        });
        it('does NOT replace when allowPluginHookRefresh is true (plugin safety)', () => {
            // When running as a plugin with refreshHooksInPlugin, forceHooks should
            // not clobber user hooks — falls through to the force=true merge path
            // (since allowPluginHookRefresh=true disables the forceHooks branch).
            // This test exercises the guard: forceHooks && !allowPluginHookRefresh.
            const existing = [userGroup(USER_CMD), omgGroup(OMG_CMD)];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged } = mergeEventHooks(existing, newOmg, {
                forceHooks: true,
                allowPluginHookRefresh: true,
                // Note: force is not set, so falls to "no force" branch
            });
            // Without force set, the no-force branch runs → merged unchanged
            expect(merged).toEqual(existing);
        });
    });
    describe('edge cases', () => {
        it('handles event type with no existing hooks (empty array)', () => {
            // When existingHooks[eventType] exists but is empty
            const existing = [];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { merged, conflicts } = mergeEventHooks(existing, newOmg, { force: true });
            // nonOmgGroups will be empty, so merged = [] + newOmgGroups
            expect(merged).toEqual(newOmg);
            expect(conflicts).toHaveLength(0);
        });
        it('handles hook group with non-command type (should not be treated as non-OMG)', () => {
            // A hook group with type != 'command' should not count as non-OMG
            const existing = [{ hooks: [{ type: 'webhook', command: '' }] }];
            const newOmg = [omgGroup(NEW_OMG_CMD)];
            const { conflicts } = mergeEventHooks(existing, newOmg, { force: true });
            // The webhook group has no command-type hooks → nonOmgGroups is empty
            expect(conflicts).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=installer-hooks-merge.test.js.map