/**
 * Native tmux shell launch for omg
 * Launches Gemini Code with tmux session management
 */

import { execFileSync } from 'child_process';
import {
  resolveLaunchPolicy,
  buildTmuxSessionName,
  buildTmuxShellCommand,
  wrapWithLoginShell,
  isGeminiAvailable,
  resolveGeminiPath,
} from './tmux-utils.js';

// Flag mapping
const MADMAX_FLAG = '--madmax';
const YOLO_FLAG = '--yolo';
const GEMINI_BYPASS_FLAG = '--dangerously-skip-permissions';
const NOTIFY_FLAG = '--notify';

/**
 * Extract the OMG-specific --notify flag from launch args.
 * --notify false  → disable notifications (OMG_NOTIFY=0)
 * --notify true   → enable notifications (default)
 * This flag must be stripped before passing args to Gemini CLI.
 */
export function extractNotifyFlag(args: string[]): { notifyEnabled: boolean; remainingArgs: string[] } {
  let notifyEnabled = true;
  const remainingArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === NOTIFY_FLAG) {
      const next = args[i + 1];
      if (next !== undefined) {
        const lowered = next.toLowerCase();
        if (lowered === 'true' || lowered === 'false' || lowered === '1' || lowered === '0') {
          notifyEnabled = lowered !== 'false' && lowered !== '0';
          i++; // skip explicit value token
        }
      }
    } else if (arg.startsWith(`${NOTIFY_FLAG}=`)) {
      const val = arg.slice(NOTIFY_FLAG.length + 1).toLowerCase();
      notifyEnabled = val !== 'false' && val !== '0';
    } else {
      remainingArgs.push(arg);
    }
  }

  return { notifyEnabled, remainingArgs };
}

/**
 * Normalize Gemini launch arguments
 * Maps --madmax/--yolo to --dangerously-skip-permissions
 */
export function normalizeGeminiLaunchArgs(args: string[]): string[] {
  const normalized: string[] = [];
  let wantsBypass = false;
  let hasBypass = false;

  for (const arg of args) {
    if (arg === MADMAX_FLAG || arg === YOLO_FLAG) {
      wantsBypass = true;
      continue;
    }

    if (arg === GEMINI_BYPASS_FLAG) {
      wantsBypass = true;
      if (!hasBypass) {
        normalized.push(arg);
        hasBypass = true;
      }
      continue;
    }

    normalized.push(arg);
  }

  if (wantsBypass && !hasBypass) {
    normalized.push(GEMINI_BYPASS_FLAG);
  }

  return normalized;
}

/**
 * Check if args contain --print or -p flag.
 */
export function isPrintMode(args: string[]): boolean {
  return args.some((arg) => arg === '--print' || arg === '-p');
}

/**
 * runGemini: Launch Gemini CLI (blocks until exit)
 */
export function runGemini(cwd: string, args: string[], sessionId: string): void {
  // Print mode must bypass tmux so stdout flows to the parent process
  if (isPrintMode(args)) {
    runGeminiDirect(cwd, args);
    return;
  }

  const policy = resolveLaunchPolicy(process.env, args);

  switch (policy) {
    case 'inside-tmux':
      runGeminiInsideTmux(cwd, args);
      break;
    case 'outside-tmux':
      runGeminiOutsideTmux(cwd, args, sessionId);
      break;
    case 'direct':
      runGeminiDirect(cwd, args);
      break;
  }
}

/**
 * Run Gemini inside existing tmux session
 */
function runGeminiInsideTmux(cwd: string, args: string[]): void {
  try {
    execFileSync('tmux', ['set-option', 'mouse', 'on'], { stdio: 'ignore' });
  } catch { /* ignored */ }

  try {
    execFileSync(resolveGeminiPath(), args, { cwd, stdio: 'inherit' });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { status?: number | null };
    if (err.code === 'ENOENT') {
      console.error('[omg] Error: gemini CLI not found in PATH.');
      process.exit(1);
    }
    process.exit(typeof err.status === 'number' ? err.status : 1);
  }
}

/**
 * Run Gemini outside tmux - create new session
 */
function runGeminiOutsideTmux(cwd: string, args: string[], _sessionId: string): void {
  const rawGeminiCmd = buildTmuxShellCommand(resolveGeminiPath(), args);
  const geminiCmd = wrapWithLoginShell(`sleep 0.3; perl -e 'use POSIX;tcflush(0,TCIFLUSH)' 2>/dev/null; ${rawGeminiCmd}`);
  const sessionName = buildTmuxSessionName(cwd);

  const tmuxArgs = [
    'new-session', '-d', '-s', sessionName, '-c', cwd,
    geminiCmd,
    ';', 'set-option', '-t', sessionName, 'mouse', 'on',
    ';', 'attach-session', '-t', sessionName,
  ];

  try {
    execFileSync('tmux', tmuxArgs, { stdio: 'inherit' });
  } catch {
    runGeminiDirect(cwd, args);
  }
}

/**
 * Run Gemini directly (no tmux)
 */
function runGeminiDirect(cwd: string, args: string[]): void {
  try {
    execFileSync(resolveGeminiPath(), args, { cwd, stdio: 'inherit' });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { status?: number | null };
    if (err.code === 'ENOENT') {
      console.error('[omg] Error: gemini CLI not found in PATH.');
      process.exit(1);
    }
    process.exit(typeof err.status === 'number' ? err.status : 1);
  }
}

/**
 * Main launch command entry point
 */
export async function launchCommand(args: string[]): Promise<void> {
  const { notifyEnabled, remainingArgs } = extractNotifyFlag(args);
  if (!notifyEnabled) {
    process.env.OMG_NOTIFY = '0';
  }

  // Pre-flight checks
  if (process.env.GEMINICODE) {
    console.error('[omg] Error: Already inside a Gemini Code session.');
    process.exit(1);
  }

  if (!isGeminiAvailable()) {
    console.error('[omg] Error: gemini CLI not found.');
    process.exit(1);
  }

  const normalizedArgs = normalizeGeminiLaunchArgs(remainingArgs);
  const sessionId = `omg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    runGemini(process.cwd(), normalizedArgs, sessionId);
  } finally {
    // Cleanup if needed
  }
}
