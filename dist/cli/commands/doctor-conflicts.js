/**
 * Conflict diagnostic command
 * Scans for and reports plugin coexistence issues.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getGeminiConfigDir } from '../../utils/paths.js';
import { isOmgHook } from '../../installer/index.js';
import { colors } from '../utils/formatting.js';
import { listBuiltinSkillNames } from '../../features/builtin-skills/skills.js';
import { inspectUnifiedMcpRegistrySync } from '../../installer/mcp-registry.js';
/**
 * Collect hook entries from a single settings.json file.
 */
function collectHooksFromSettings(settingsPath) {
    const conflicts = [];
    if (!existsSync(settingsPath)) {
        return conflicts;
    }
    try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        const hooks = settings.hooks || {};
        // Hook events to check
        const hookEvents = [
            'PreToolUse',
            'PostToolUse',
            'Stop',
            'SessionStart',
            'SessionEnd',
            'UserPromptSubmit'
        ];
        for (const event of hookEvents) {
            if (hooks[event] && Array.isArray(hooks[event])) {
                const eventHookGroups = hooks[event];
                for (const group of eventHookGroups) {
                    if (!group.hooks || !Array.isArray(group.hooks))
                        continue;
                    for (const hook of group.hooks) {
                        if (hook.type === 'command' && hook.command) {
                            conflicts.push({ event, command: hook.command, isOmg: isOmgHook(hook.command) });
                        }
                    }
                }
            }
        }
    }
    catch (_error) {
        // Ignore parse errors, will be reported separately
    }
    return conflicts;
}
/**
 * Check for hook conflicts in both profile-level (~/.gemini/settings.json)
 * and project-level (./.gemini/settings.json).
 *
 * Gemini Code settings precedence: project > profile > defaults.
 * We check both levels so the diagnostic is complete.
 */
export function checkHookConflicts() {
    const profileSettingsPath = join(getGeminiConfigDir(), 'settings.json');
    const projectSettingsPath = join(process.cwd(), '.gemini', 'settings.json');
    const profileHooks = collectHooksFromSettings(profileSettingsPath);
    const projectHooks = collectHooksFromSettings(projectSettingsPath);
    // Deduplicate by event+command (same hook in both levels should appear once)
    const seen = new Set();
    const merged = [];
    for (const hook of [...projectHooks, ...profileHooks]) {
        const key = `${hook.event}::${hook.command}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(hook);
        }
    }
    return merged;
}
/**
 * Check a single file for OMG markers.
 * Returns { hasMarkers, hasUserContent } or null on error.
 */
function checkFileForOmgMarkers(filePath) {
    if (!existsSync(filePath))
        return null;
    try {
        const content = readFileSync(filePath, 'utf-8');
        const hasStartMarker = content.includes('<!-- OMG:START -->');
        const hasEndMarker = content.includes('<!-- OMG:END -->');
        const hasMarkers = hasStartMarker && hasEndMarker;
        let hasUserContent = false;
        if (hasMarkers) {
            const startIdx = content.indexOf('<!-- OMG:START -->');
            const endIdx = content.indexOf('<!-- OMG:END -->');
            const beforeMarker = content.substring(0, startIdx).trim();
            const afterMarker = content.substring(endIdx + '<!-- OMG:END -->'.length).trim();
            hasUserContent = beforeMarker.length > 0 || afterMarker.length > 0;
        }
        else {
            hasUserContent = content.trim().length > 0;
        }
        return { hasMarkers, hasUserContent };
    }
    catch {
        return null;
    }
}
/**
 * Find companion GEMINI-*.md files in the config directory.
 * These are files like GEMINI-omg.md that users create as part of a
 * file-split pattern to keep OMG config separate from their own GEMINI.md.
 */
function findCompanionGeminiMdFiles(configDir) {
    try {
        return readdirSync(configDir)
            .filter(f => /^GEMINI-.+\.md$/i.test(f))
            .map(f => join(configDir, f));
    }
    catch {
        return [];
    }
}
/**
 * Check GEMINI.md for OMG markers and user content.
 * Also checks companion files (GEMINI-omg.md, etc.) for the file-split pattern
 * where users keep OMG config in a separate file.
 */
export function checkGeminiMdStatus() {
    const configDir = getGeminiConfigDir();
    const geminiMdPath = join(configDir, 'GEMINI.md');
    if (!existsSync(geminiMdPath)) {
        return null;
    }
    try {
        // Check the main GEMINI.md first
        const mainResult = checkFileForOmgMarkers(geminiMdPath);
        if (!mainResult)
            return null;
        if (mainResult.hasMarkers) {
            return {
                hasMarkers: true,
                hasUserContent: mainResult.hasUserContent,
                path: geminiMdPath
            };
        }
        // No markers in main file - check companion files (file-split pattern)
        const companions = findCompanionGeminiMdFiles(configDir);
        for (const companionPath of companions) {
            const companionResult = checkFileForOmgMarkers(companionPath);
            if (companionResult?.hasMarkers) {
                return {
                    hasMarkers: true,
                    hasUserContent: mainResult.hasUserContent,
                    path: geminiMdPath,
                    companionFile: companionPath
                };
            }
        }
        // No markers in main or companions - check if GEMINI.md references a companion
        const content = readFileSync(geminiMdPath, 'utf-8');
        const companionRefPattern = /GEMINI-[^\s)]+\.md/i;
        const refMatch = content.match(companionRefPattern);
        if (refMatch) {
            // GEMINI.md references a companion file but it doesn't have markers yet
            return {
                hasMarkers: false,
                hasUserContent: mainResult.hasUserContent,
                path: geminiMdPath,
                companionFile: join(configDir, refMatch[0])
            };
        }
        return {
            hasMarkers: false,
            hasUserContent: mainResult.hasUserContent,
            path: geminiMdPath
        };
    }
    catch (_error) {
        return null;
    }
}
/**
 * Check environment flags that affect OMG behavior
 */
export function checkEnvFlags() {
    const disableOmg = process.env.DISABLE_OMG === 'true' || process.env.DISABLE_OMG === '1';
    const skipHooks = [];
    if (process.env.OMG_SKIP_HOOKS) {
        skipHooks.push(...process.env.OMG_SKIP_HOOKS.split(',').map(h => h.trim()));
    }
    return { disableOmg, skipHooks };
}
/**
 * Check for legacy curl-installed skills that collide with plugin skill names.
 * Only flags skills whose names match actual installed plugin skills, avoiding
 * false positives for user's custom skills.
 */
export function checkLegacySkills() {
    const legacySkillsDir = join(getGeminiConfigDir(), 'skills');
    if (!existsSync(legacySkillsDir))
        return [];
    const collisions = [];
    try {
        const pluginSkillNames = new Set(listBuiltinSkillNames({ includeAliases: true }).map(n => n.toLowerCase()));
        const entries = readdirSync(legacySkillsDir);
        for (const entry of entries) {
            // Match .md files or directories whose name collides with a plugin skill
            const baseName = entry.replace(/\.md$/i, '').toLowerCase();
            if (pluginSkillNames.has(baseName)) {
                collisions.push({ name: baseName, path: join(legacySkillsDir, entry) });
            }
        }
    }
    catch {
        // Ignore read errors
    }
    return collisions;
}
/**
 * Check for unknown fields in config files
 */
export function checkConfigIssues() {
    const unknownFields = [];
    const configPath = join(getGeminiConfigDir(), '.omg-config.json');
    if (!existsSync(configPath)) {
        return { unknownFields };
    }
    try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        // Known top-level fields from the current config surfaces:
        // - PluginConfig (src/shared/types.ts)
        // - OMGConfig (src/features/auto-update.ts)
        // - direct .omg-config.json readers/writers (notifications, auto-invoke,
        //   delegation enforcement, omg-setup team config)
        // - preserved legacy compatibility keys that still appear in user configs
        const knownFields = new Set([
            // PluginConfig fields
            'agents',
            'features',
            'mcpServers',
            'permissions',
            'magicKeywords',
            'routing',
            // OMGConfig fields (from auto-update.ts / omg-setup)
            'silentAutoUpdate',
            'configuredAt',
            'configVersion',
            'taskTool',
            'taskToolConfig',
            'defaultExecutionMode',
            'bashHistory',
            'agentTiers',
            'setupCompleted',
            'setupVersion',
            'stopHookCallbacks',
            'notifications',
            'notificationProfiles',
            'hudEnabled',
            'autoUpgradePrompt',
            'nodeBinary',
            // Direct config readers / writers outside OMGConfig
            'customIntegrations',
            'delegationEnforcementLevel',
            'enforcementLevel',
            'autoInvoke',
            'team',
        ]);
        for (const field of Object.keys(config)) {
            if (!knownFields.has(field)) {
                unknownFields.push(field);
            }
        }
    }
    catch (_error) {
        // Ignore parse errors
    }
    return { unknownFields };
}
/**
 * Run complete conflict check
 */
export function runConflictCheck() {
    const hookConflicts = checkHookConflicts();
    const geminiMdStatus = checkGeminiMdStatus();
    const legacySkills = checkLegacySkills();
    const envFlags = checkEnvFlags();
    const configIssues = checkConfigIssues();
    const mcpRegistrySync = inspectUnifiedMcpRegistrySync();
    // Determine if there are actual conflicts
    const hasConflicts = hookConflicts.some(h => !h.isOmg) || // Non-OMG hooks present
        legacySkills.length > 0 || // Legacy skills colliding with plugin
        envFlags.disableOmg || // OMG is disabled
        envFlags.skipHooks.length > 0 || // Hooks are being skipped
        configIssues.unknownFields.length > 0 || // Unknown config fields
        mcpRegistrySync.geminiMissing.length > 0 ||
        mcpRegistrySync.geminiMismatched.length > 0 ||
        mcpRegistrySync.geminiMissing.length > 0 ||
        mcpRegistrySync.geminiMismatched.length > 0;
    // Note: Missing OMG markers is informational (normal for fresh install), not a conflict
    return {
        hookConflicts,
        geminiMdStatus,
        legacySkills,
        envFlags,
        configIssues,
        mcpRegistrySync,
        hasConflicts
    };
}
/**
 * Format report for display
 */
export function formatReport(report, json) {
    if (json) {
        return JSON.stringify(report, null, 2);
    }
    // Human-readable format
    const lines = [];
    lines.push('');
    lines.push(colors.bold('🔍 Oh-My-GeminiCode Conflict Diagnostic'));
    lines.push(colors.gray('━'.repeat(60)));
    lines.push('');
    // Hook conflicts
    if (report.hookConflicts.length > 0) {
        lines.push(colors.bold('📌 Hook Configuration'));
        lines.push('');
        for (const hook of report.hookConflicts) {
            const status = hook.isOmg ? colors.green('✓ OMG') : colors.yellow('⚠ Other');
            lines.push(`  ${hook.event.padEnd(20)} ${status}`);
            lines.push(`    ${colors.gray(hook.command)}`);
        }
        lines.push('');
    }
    else {
        lines.push(colors.bold('📌 Hook Configuration'));
        lines.push(`  ${colors.gray('No hooks configured')}`);
        lines.push('');
    }
    // GEMINI.md status
    if (report.geminiMdStatus) {
        lines.push(colors.bold('📄 GEMINI.md Status'));
        lines.push('');
        if (report.geminiMdStatus.hasMarkers) {
            if (report.geminiMdStatus.companionFile) {
                lines.push(`  ${colors.green('✓')} OMG markers found in companion file`);
                lines.push(`    ${colors.gray(`Companion: ${report.geminiMdStatus.companionFile}`)}`);
            }
            else {
                lines.push(`  ${colors.green('✓')} OMG markers present`);
            }
            if (report.geminiMdStatus.hasUserContent) {
                lines.push(`  ${colors.green('✓')} User content preserved outside markers`);
            }
        }
        else {
            lines.push(`  ${colors.yellow('⚠')} No OMG markers found`);
            lines.push(`    ${colors.gray('Run /oh-my-gemini:omg-setup to add markers')}`);
            if (report.geminiMdStatus.hasUserContent) {
                lines.push(`  ${colors.blue('ℹ')} User content present - will be preserved`);
            }
        }
        lines.push(`  ${colors.gray(`Path: ${report.geminiMdStatus.path}`)}`);
        lines.push('');
    }
    else {
        lines.push(colors.bold('📄 GEMINI.md Status'));
        lines.push(`  ${colors.gray('No GEMINI.md found')}`);
        lines.push('');
    }
    // Environment flags
    lines.push(colors.bold('🔧 Environment Flags'));
    lines.push('');
    if (report.envFlags.disableOmg) {
        lines.push(`  ${colors.red('✗')} DISABLE_OMG is set - OMG is disabled`);
    }
    else {
        lines.push(`  ${colors.green('✓')} DISABLE_OMG not set`);
    }
    if (report.envFlags.skipHooks.length > 0) {
        lines.push(`  ${colors.yellow('⚠')} OMG_SKIP_HOOKS: ${report.envFlags.skipHooks.join(', ')}`);
    }
    else {
        lines.push(`  ${colors.green('✓')} No hooks are being skipped`);
    }
    lines.push('');
    // Legacy skills
    if (report.legacySkills.length > 0) {
        lines.push(colors.bold('📦 Legacy Skills'));
        lines.push('');
        lines.push(`  ${colors.yellow('⚠')} Skills colliding with plugin skill names:`);
        for (const skill of report.legacySkills) {
            lines.push(`    - ${skill.name} ${colors.gray(`(${skill.path})`)}`);
        }
        lines.push(`    ${colors.gray('These legacy files shadow plugin skills. Remove them or rename to avoid conflicts.')}`);
        lines.push('');
    }
    // Config issues
    if (report.configIssues.unknownFields.length > 0) {
        lines.push(colors.bold('⚙️  Configuration Issues'));
        lines.push('');
        lines.push(`  ${colors.yellow('⚠')} Unknown fields in .omg-config.json:`);
        for (const field of report.configIssues.unknownFields) {
            lines.push(`    - ${field}`);
        }
        lines.push('');
    }
    // Unified MCP registry sync
    lines.push(colors.bold('🧩 Unified MCP Registry'));
    lines.push('');
    if (!report.mcpRegistrySync.registryExists) {
        lines.push(`  ${colors.gray('No unified MCP registry found')}`);
        lines.push(`    ${colors.gray(`Expected path: ${report.mcpRegistrySync.registryPath}`)}`);
    }
    else if (report.mcpRegistrySync.serverNames.length === 0) {
        lines.push(`  ${colors.gray('Registry exists but has no MCP servers')}`);
        lines.push(`    ${colors.gray(`Path: ${report.mcpRegistrySync.registryPath}`)}`);
    }
    else {
        lines.push(`  ${colors.green('✓')} Registry servers: ${report.mcpRegistrySync.serverNames.join(', ')}`);
        lines.push(`    ${colors.gray(`Registry: ${report.mcpRegistrySync.registryPath}`)}`);
        lines.push(`    ${colors.gray(`Gemini MCP: ${report.mcpRegistrySync.geminiConfigPath}`)}`);
        lines.push(`    ${colors.gray(`Gemini: ${report.mcpRegistrySync.geminiConfigPath}`)}`);
        if (report.mcpRegistrySync.geminiMissing.length > 0) {
            lines.push(`  ${colors.yellow('⚠')} Missing from Gemini MCP config: ${report.mcpRegistrySync.geminiMissing.join(', ')}`);
        }
        else if (report.mcpRegistrySync.geminiMismatched.length > 0) {
            lines.push(`  ${colors.yellow('⚠')} Mismatched in Gemini MCP config: ${report.mcpRegistrySync.geminiMismatched.join(', ')}`);
        }
        else {
            lines.push(`  ${colors.green('✓')} Gemini MCP config is in sync`);
        }
        if (report.mcpRegistrySync.geminiMissing.length > 0) {
            lines.push(`  ${colors.yellow('⚠')} Missing from Gemini config.toml: ${report.mcpRegistrySync.geminiMissing.join(', ')}`);
        }
        else if (report.mcpRegistrySync.geminiMismatched.length > 0) {
            lines.push(`  ${colors.yellow('⚠')} Mismatched in Gemini config.toml: ${report.mcpRegistrySync.geminiMismatched.join(', ')}`);
        }
        else {
            lines.push(`  ${colors.green('✓')} Gemini config.toml is in sync`);
        }
    }
    lines.push('');
    // Summary
    lines.push(colors.gray('━'.repeat(60)));
    if (report.hasConflicts) {
        lines.push(`${colors.yellow('⚠')} Potential conflicts detected`);
        lines.push(`${colors.gray('Review the issues above and run /oh-my-gemini:omg-setup if needed')}`);
    }
    else {
        lines.push(`${colors.green('✓')} No conflicts detected`);
        lines.push(`${colors.gray('OMG is properly configured')}`);
    }
    lines.push('');
    return lines.join('\n');
}
/**
 * Doctor conflicts command
 */
export async function doctorConflictsCommand(options) {
    const report = runConflictCheck();
    console.log(formatReport(report, options.json ?? false));
    return report.hasConflicts ? 1 : 0;
}
//# sourceMappingURL=doctor-conflicts.js.map