/**
 * Native tmux shell launch for omg
 * Launches Gemini Code with tmux session management
 */
/**
 * Extract the OMG-specific --notify flag from launch args.
 * --notify false  → disable notifications (OMG_NOTIFY=0)
 * --notify true   → enable notifications (default)
 * This flag must be stripped before passing args to Gemini CLI.
 */
export declare function extractNotifyFlag(args: string[]): {
    notifyEnabled: boolean;
    remainingArgs: string[];
};
/**
 * Normalize Gemini launch arguments
 * Maps --madmax/--yolo to --dangerously-skip-permissions
 */
export declare function normalizeGeminiLaunchArgs(args: string[]): string[];
/**
 * Check if args contain --print or -p flag.
 */
export declare function isPrintMode(args: string[]): boolean;
/**
 * runGemini: Launch Gemini CLI (blocks until exit)
 */
export declare function runGemini(cwd: string, args: string[], sessionId: string): void;
/**
 * Main launch command entry point
 */
export declare function launchCommand(args: string[]): Promise<void>;
//# sourceMappingURL=launch.d.ts.map