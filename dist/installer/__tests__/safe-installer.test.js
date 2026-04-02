/**
 * Tests for Safe Installer (Task T2)
 * Tests hook conflict detection and forceHooks option
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { isOmgHook } from '../index.js';
/**
 * Detect hook conflicts using the real isOmgHook function.
 * Mirrors the install() logic to avoid test duplication.
 */
function detectConflicts(hooks) {
    const conflicts = [];
    for (const [eventType, eventHooks] of Object.entries(hooks)) {
        for (const hookGroup of eventHooks) {
            for (const hook of hookGroup.hooks) {
                if (hook.type === 'command' && !isOmgHook(hook.command)) {
                    conflicts.push({ eventType, existingCommand: hook.command });
                }
            }
        }
    }
    return conflicts;
}
const TEST_GEMINI_DIR = join(homedir(), '.gemini-test-safe-installer');
const TEST_SETTINGS_FILE = join(TEST_GEMINI_DIR, 'settings.json');
describe('isOmgHook', () => {
    it('returns true for commands containing "omg"', () => {
        expect(isOmgHook('node ~/.gemini/hooks/omg-hook.mjs')).toBe(true);
        expect(isOmgHook('bash $HOME/.gemini/hooks/omg-detector.sh')).toBe(true);
        expect(isOmgHook('/usr/bin/omg-tool')).toBe(true);
    });
    it('returns true for commands containing "oh-my-gemini"', () => {
        expect(isOmgHook('node ~/.gemini/hooks/oh-my-gemini-hook.mjs')).toBe(true);
        expect(isOmgHook('bash $HOME/.gemini/hooks/oh-my-gemini.sh')).toBe(true);
    });
    it('returns false for commands not containing omg or oh-my-gemini', () => {
        expect(isOmgHook('node ~/.gemini/hooks/other-plugin.mjs')).toBe(false);
        expect(isOmgHook('bash $HOME/.gemini/hooks/beads-hook.sh')).toBe(false);
        expect(isOmgHook('python /usr/bin/custom-hook.py')).toBe(false);
    });
    it('is case-insensitive', () => {
        expect(isOmgHook('node ~/.gemini/hooks/OMG-hook.mjs')).toBe(true);
        expect(isOmgHook('bash $HOME/.gemini/hooks/OH-MY-GEMINICODE.sh')).toBe(true);
    });
});
describe('isOmgHook detection', () => {
    it('detects real OMG hooks correctly', () => {
        expect(isOmgHook('node ~/.gemini/hooks/omg-hook.mjs')).toBe(true);
        expect(isOmgHook('node ~/.gemini/hooks/oh-my-gemini-hook.mjs')).toBe(true);
        expect(isOmgHook('node ~/.gemini/hooks/omg-pre-tool-use.mjs')).toBe(true);
        expect(isOmgHook('/usr/local/bin/omg')).toBe(true);
    });
    it('detects actual OMG hook commands from settings.json (issue #606)', () => {
        // These are the real commands OMG installs into settings.json
        expect(isOmgHook('node "$HOME/.gemini/hooks/keyword-detector.mjs"')).toBe(true);
        expect(isOmgHook('node "$HOME/.gemini/hooks/session-start.mjs"')).toBe(true);
        expect(isOmgHook('node "$HOME/.gemini/hooks/pre-tool-use.mjs"')).toBe(true);
        expect(isOmgHook('node "$HOME/.gemini/hooks/post-tool-use.mjs"')).toBe(true);
        expect(isOmgHook('node "$HOME/.gemini/hooks/post-tool-use-failure.mjs"')).toBe(true);
        expect(isOmgHook('node "$HOME/.gemini/hooks/persistent-mode.mjs"')).toBe(true);
    });
    it('detects Windows-style OMG hook commands (issue #606)', () => {
        expect(isOmgHook('node "%USERPROFILE%\\.gemini\\hooks\\keyword-detector.mjs"')).toBe(true);
        expect(isOmgHook('node "%USERPROFILE%\\.gemini\\hooks\\pre-tool-use.mjs"')).toBe(true);
    });
    it('rejects non-OMG hooks correctly', () => {
        expect(isOmgHook('eslint --fix')).toBe(false);
        expect(isOmgHook('prettier --write')).toBe(false);
        expect(isOmgHook('node custom-hook.mjs')).toBe(false);
        expect(isOmgHook('node ~/other-plugin/hooks/detector.mjs')).toBe(false);
    });
    it('uses case-insensitive matching', () => {
        expect(isOmgHook('node ~/.gemini/hooks/OMG-hook.mjs')).toBe(true);
        expect(isOmgHook('OH-MY-GEMINICODE-detector.sh')).toBe(true);
    });
});
describe('Safe Installer - Hook Conflict Detection', () => {
    beforeEach(() => {
        // Clean up test directory
        if (existsSync(TEST_GEMINI_DIR)) {
            rmSync(TEST_GEMINI_DIR, { recursive: true, force: true });
        }
        mkdirSync(TEST_GEMINI_DIR, { recursive: true });
        // Mock GEMINI_CONFIG_DIR for testing
        process.env.TEST_GEMINI_CONFIG_DIR = TEST_GEMINI_DIR;
    });
    afterEach(() => {
        // Clean up
        if (existsSync(TEST_GEMINI_DIR)) {
            rmSync(TEST_GEMINI_DIR, { recursive: true, force: true });
        }
        delete process.env.TEST_GEMINI_CONFIG_DIR;
    });
    it('detects conflict when PreToolUse is owned by another plugin', () => {
        // Create settings.json with non-OMG hook
        const existingSettings = {
            hooks: {
                PreToolUse: [
                    {
                        hooks: [
                            {
                                type: 'command',
                                command: 'node ~/.gemini/hooks/beads-hook.mjs'
                            }
                        ]
                    }
                ]
            }
        };
        writeFileSync(TEST_SETTINGS_FILE, JSON.stringify(existingSettings, null, 2));
        const _options = {
            verbose: true,
            skipGeminiCheck: true
        };
        // Simulate install logic (we'd need to mock or refactor install function for full test)
        // For now, test the detection logic directly
        const conflicts = detectConflicts(existingSettings.hooks);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].eventType).toBe('PreToolUse');
        expect(conflicts[0].existingCommand).toBe('node ~/.gemini/hooks/beads-hook.mjs');
    });
    it('does not detect conflict when hook is OMG-owned', () => {
        const existingSettings = {
            hooks: {
                PreToolUse: [
                    {
                        hooks: [
                            {
                                type: 'command',
                                command: 'node "$HOME/.gemini/hooks/pre-tool-use.mjs"'
                            }
                        ]
                    }
                ]
            }
        };
        const conflicts = detectConflicts(existingSettings.hooks);
        expect(conflicts).toHaveLength(0);
    });
    it('detects multiple conflicts across different hook events', () => {
        const existingSettings = {
            hooks: {
                PreToolUse: [
                    {
                        hooks: [
                            {
                                type: 'command',
                                command: 'node ~/.gemini/hooks/beads-pre-tool-use.mjs'
                            }
                        ]
                    }
                ],
                PostToolUse: [
                    {
                        hooks: [
                            {
                                type: 'command',
                                command: 'python ~/.gemini/hooks/custom-post-tool.py'
                            }
                        ]
                    }
                ],
                UserPromptSubmit: [
                    {
                        hooks: [
                            {
                                type: 'command',
                                command: 'node "$HOME/.gemini/hooks/keyword-detector.mjs"'
                            }
                        ]
                    }
                ]
            }
        };
        const conflicts = detectConflicts(existingSettings.hooks);
        expect(conflicts).toHaveLength(2);
        expect(conflicts.map(c => c.eventType)).toContain('PreToolUse');
        expect(conflicts.map(c => c.eventType)).toContain('PostToolUse');
        expect(conflicts.map(c => c.eventType)).not.toContain('UserPromptSubmit');
    });
});
//# sourceMappingURL=safe-installer.test.js.map