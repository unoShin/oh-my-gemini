/**
 * OMG HUD - State Management
 *
 * Manages HUD state file for background task tracking.
 * Follows patterns from ultrawork-state.
 */
import type { OmgHudState, BackgroundTask, HudConfig } from "./types.js";
/**
 * Read HUD state from disk (checks new local and legacy local only)
 */
export declare function readHudState(directory?: string): OmgHudState | null;
/**
 * Write HUD state to disk (local only)
 */
export declare function writeHudState(state: OmgHudState, directory?: string): boolean;
/**
 * Create a new empty HUD state
 */
export declare function createEmptyHudState(): OmgHudState;
/**
 * Get running background tasks from state
 */
export declare function getRunningTasks(state: OmgHudState | null): BackgroundTask[];
/**
 * Get background task count string (e.g., "3/5")
 */
export declare function getBackgroundTaskCount(state: OmgHudState | null): {
    running: number;
    max: number;
};
/**
 * Read HUD configuration from disk.
 * Priority: settings.json > hud-config.json (legacy) > defaults
 */
export declare function readHudConfig(): HudConfig;
/**
 * Write HUD configuration to ~/.gemini/settings.json (omgHud key)
 */
export declare function writeHudConfig(config: HudConfig): boolean;
/**
 * Apply a preset to the configuration
 */
export declare function applyPreset(preset: HudConfig["preset"]): HudConfig;
/**
 * Initialize HUD state with cleanup of stale/orphaned tasks.
 * Should be called on HUD startup.
 */
export declare function initializeHUDState(directory?: string): Promise<void>;
//# sourceMappingURL=state.d.ts.map