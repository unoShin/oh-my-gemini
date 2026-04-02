/**
 * Configuration Loader
 *
 * Handles loading and merging configuration from multiple sources:
 * - User config: ~/.config/gemini-omg/config.jsonc
 * - Project config: .gemini/omg.jsonc
 * - Environment variables
 */
import type { PluginConfig } from "../shared/types.js";
/**
 * Default configuration.
 *
 * Model IDs are resolved from environment variables (OMG_MODEL_HIGH,
 * OMG_MODEL_MEDIUM, OMG_MODEL_LOW) with built-in fallbacks.
 * User/project config files can further override via deepMerge.
 *
 * Note: env vars for external model defaults (OMG_GEMINI_DEFAULT_MODEL,
 * OMG_GEMINI_DEFAULT_MODEL) are read lazily in loadEnvConfig() to avoid
 * capturing stale values at module load time.
 */
export declare function buildDefaultConfig(): PluginConfig;
export declare const DEFAULT_CONFIG: PluginConfig;
/**
 * Configuration file locations
 */
export declare function getConfigPaths(): {
    user: string;
    project: string;
};
/**
 * Load and parse a JSONC file
 */
export declare function loadJsoncFile(path: string): PluginConfig | null;
/**
 * Deep merge two objects
 */
export declare function deepMerge<T extends object>(target: T, source: Partial<T>): T;
/**
 * Load configuration from environment variables
 */
export declare function loadEnvConfig(): Partial<PluginConfig>;
/**
 * Load and merge all configuration sources
 */
export declare function loadConfig(): PluginConfig;
export declare function compactOmgStartupGuidance(content: string): string;
/**
 * Find and load AGENTS.md or GEMINI.md files for context injection
 */
export declare function findContextFiles(startDir?: string): string[];
/**
 * Load context from AGENTS.md/GEMINI.md files
 */
export declare function loadContextFromFiles(files: string[]): string;
/**
 * Generate JSON Schema for configuration (for editor autocomplete)
 */
export declare function generateConfigSchema(): object;
//# sourceMappingURL=loader.d.ts.map