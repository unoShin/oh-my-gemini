/**
 * Validate that a config path is under the user's home directory
 * and contains a trusted subpath (Gemini config dir or ~/.omg/).
 * Resolves the path first to defeat traversal attacks like ~/foo/.gemini/../../evil.json.
 */
export declare function validateConfigPath(configPath: string, homeDir: string, geminiConfigDir: string): boolean;
//# sourceMappingURL=bridge-entry.d.ts.map