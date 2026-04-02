/**
 * Installer Module
 *
 * Handles installation of OMG agents, commands, and configuration
 * into the Gemini Code config directory (~/.gemini/).
 *
 * Cross-platform support via Node.js-based hook scripts (.mjs).
 * Bash hook scripts were removed in v3.9.0.
 */
/** Current version */
export declare const VERSION = "0.1.0";
/** Gemini Code configuration directory */
export declare const GEMINI_CONFIG_DIR: string;
export declare const AGENTS_DIR: string;
export declare const COMMANDS_DIR: string;
export declare const SKILLS_DIR: string;
export declare const HOOKS_DIR: string;
export declare const HUD_DIR: string;
export declare const SETTINGS_FILE: string;
export declare const VERSION_FILE: string;
/**
 * Core commands - DISABLED for v3.0+
 * All commands are now plugin-scoped skills managed by Gemini Code.
 * The installer no longer copies commands to ~/.gemini/commands/
 */
export declare const CORE_COMMANDS: string[];
/** Installation result */
export interface InstallResult {
    success: boolean;
    message: string;
    installedAgents: string[];
    installedCommands: string[];
    installedSkills: string[];
    hooksConfigured: boolean;
    hookConflicts: Array<{
        eventType: string;
        existingCommand: string;
    }>;
    errors: string[];
}
/** Installation options */
export interface InstallOptions {
    force?: boolean;
    version?: string;
    verbose?: boolean;
    skipGeminiCheck?: boolean;
    forceHooks?: boolean;
    refreshHooksInPlugin?: boolean;
    skipHud?: boolean;
}
/**
 * Read hudEnabled from .omg-config.json without importing auto-update
 * (avoids circular dependency since auto-update imports from installer)
 */
export declare function isHudEnabledInConfig(): boolean;
/**
 * Detect whether a statusLine config belongs to oh-my-gemini.
 *
 * Checks the command string for known OMG HUD paths so that custom
 * (non-OMG) statusLine configurations are preserved during forced
 * updates/reconciliation.
 *
 * @param statusLine - The statusLine setting object from settings.json
 * @returns true if the statusLine was set by OMG
 */
export declare function isOmgStatusLine(statusLine: unknown): boolean;
/**
 * Detect whether a hook command belongs to oh-my-gemini.
 *
 * Recognition strategy (any match is sufficient):
 * 1. Command path contains "omg" as a path/word segment (e.g. `omg-hook.mjs`, `/omg/`)
 * 2. Command path contains "oh-my-gemini"
 * 3. Command references a known OMG hook filename inside .gemini/hooks/
 *
 * @param command - The hook command string
 * @returns true if the command belongs to OMG
 */
export declare function isOmgHook(command: string): boolean;
/**
 * Check if the current Node.js version meets the minimum requirement
 */
export declare function checkNodeVersion(): {
    valid: boolean;
    current: number;
    required: number;
};
/**
 * Check if Gemini Code is installed
 * Uses 'where' on Windows, 'which' on Unix
 */
export declare function isGeminiInstalled(): boolean;
/**
 * Check if we're running in Gemini Code plugin context
 *
 * When installed as a plugin, we should NOT copy files to ~/.gemini/
 * because the plugin system already handles file access via ${GEMINI_PLUGIN_ROOT}.
 *
 * Detection method:
 * - Check if GEMINI_PLUGIN_ROOT environment variable is set (primary method)
 * - This env var is set by the Gemini Code plugin system when running plugin hooks
 *
 * @returns true if running in plugin context, false otherwise
 */
export declare function isRunningAsPlugin(): boolean;
/**
 * Check if we're running as a project-scoped plugin (not global)
 *
 * Project-scoped plugins are installed in the project's .gemini/plugins/ directory,
 * while global plugins are installed in ~/.gemini/plugins/.
 *
 * When project-scoped, we should NOT modify global settings (like ~/.gemini/settings.json)
 * because the user explicitly chose project-level installation.
 *
 * @returns true if running as a project-scoped plugin, false otherwise
 */
export declare function isProjectScopedPlugin(): boolean;
export declare function getInstalledOmgPluginRoots(): string[];
/**
 * Detect whether an installed Gemini Code plugin already provides OMG agent
 * markdown files, so the legacy ~/.gemini/agents copy can be skipped.
 */
export declare function hasPluginProvidedAgentFiles(): boolean;
export declare function getRuntimePackageRoot(): string;
/**
 * Extract the embedded OMG version from a GEMINI.md file.
 *
 * Primary source of truth is the injected `<!-- OMG:VERSION:x.y.z -->` marker.
 * Falls back to legacy headings that may include a version string inline.
 */
export declare function extractOmgVersionFromGeminiMd(content: string): string | null;
/**
 * Keep persisted setup metadata in sync with the installed OMG runtime version.
 *
 * This intentionally updates only already-configured users by default so
 * installer/reconciliation flows do not accidentally mark fresh installs as if
 * the interactive setup wizard had been completed.
 */
export declare function syncPersistedSetupVersion(options?: {
    configPath?: string;
    geminiMdPath?: string;
    version?: string;
    onlyIfConfigured?: boolean;
}): boolean;
/**
 * Merge OMG content into existing GEMINI.md using markers
 * @param existingContent - Existing GEMINI.md content (null if file doesn't exist)
 * @param omgContent - New OMG content to inject
 * @returns Merged content with markers
 */
export declare function mergeGeminiMd(existingContent: string | null, omgContent: string, version?: string): string;
/**
 * Install OMG agents, commands, skills, and hooks
 */
export declare function install(options?: InstallOptions): InstallResult;
/**
 * Check if OMG is already installed
 */
export declare function isInstalled(): boolean;
/**
 * Get installation info
 */
export declare function getInstallInfo(): {
    version: string;
    installedAt: string;
    method: string;
} | null;
//# sourceMappingURL=index.d.ts.map