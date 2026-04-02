/**
 * Interop CLI Command - Split-pane tmux session with OMG and OMX
 *
 * Creates a tmux split-pane layout with Gemini Code (OMG) on the left
 * and Gemini CLI (OMX) on the right, with shared interop state.
 */

import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { isTmuxAvailable, isGeminiAvailable } from './tmux-utils.js';
import { initInteropSession } from '../interop/shared-state.js';

export type InteropMode = 'off' | 'observe' | 'active';

export interface InteropRuntimeFlags {
  enabled: boolean;
  mode: InteropMode;
  omgInteropToolsEnabled: boolean;
  failClosed: boolean;
}

export function readInteropRuntimeFlags(env: NodeJS.ProcessEnv = process.env): InteropRuntimeFlags {
  const rawMode = (env.OMX_OMG_INTEROP_MODE || 'off').toLowerCase();
  const mode: InteropMode = rawMode === 'observe' || rawMode === 'active' ? rawMode : 'off';
  return {
    enabled: env.OMX_OMG_INTEROP_ENABLED === '1',
    mode,
    omgInteropToolsEnabled: env.OMG_INTEROP_TOOLS_ENABLED === '1',
    failClosed: env.OMX_OMG_INTEROP_FAIL_CLOSED !== '0',
  };
}

export function validateInteropRuntimeFlags(flags: InteropRuntimeFlags): { ok: boolean; reason?: string } {
  if (!flags.enabled && flags.mode !== 'off') {
    return { ok: false, reason: 'OMX_OMG_INTEROP_MODE must be "off" when OMX_OMG_INTEROP_ENABLED=0.' };
  }

  if (flags.mode === 'active' && !flags.omgInteropToolsEnabled) {
    return { ok: false, reason: 'Active mode requires OMG_INTEROP_TOOLS_ENABLED=1.' };
  }

  return { ok: true };
}

/**
 * Launch interop session with split tmux panes
 */
export function launchInteropSession(cwd: string = process.cwd()): void {
  const flags = readInteropRuntimeFlags();
  const flagCheck = validateInteropRuntimeFlags(flags);

  console.log(`[interop] mode=${flags.mode}, enabled=${flags.enabled ? '1' : '0'}, tools=${flags.omgInteropToolsEnabled ? '1' : '0'}, failClosed=${flags.failClosed ? '1' : '0'}`);
  if (!flagCheck.ok) {
    console.error(`Error: ${flagCheck.reason}`);
    console.error('Refusing to start interop in invalid flag configuration.');
    process.exit(1);
  }

  // Check prerequisites
  if (!isTmuxAvailable()) {
    console.error('Error: tmux is not available. Install tmux to use interop mode.');
    process.exit(1);
  }

  const hasGemini = isGeminiAvailable();

  if (!hasGemini) {
    console.error('Error: gemini CLI is not available. Install Gemini Code CLI first.');
    process.exit(1);
  }

  if (!hasGemini) {
    console.warn('Warning: gemini CLI is not available. Only Gemini Code will be launched.');
  }

  // Check if already in tmux
  const inTmux = Boolean(process.env.TMUX);

  if (!inTmux) {
    console.error('Error: Interop mode requires running inside a tmux session.');
    console.error('Start tmux first: tmux new-session -s myproject');
    process.exit(1);
  }

  // Generate session ID
  const sessionId = `interop-${randomUUID().split('-')[0]}`;

  // Initialize interop session
  const _config = initInteropSession(sessionId, cwd, hasGemini ? cwd : undefined);

  console.log(`Initializing interop session: ${sessionId}`);
  console.log(`Working directory: ${cwd}`);
  console.log(`Config saved to: ${cwd}/.omg/state/interop/config.json\n`);

  // Get current pane ID
  let currentPaneId: string;
  try {
    const output = execFileSync('tmux', ['display-message', '-p', '#{pane_id}'], {
      encoding: 'utf-8',
    });
    currentPaneId = output.trim();
  } catch (_error) {
    console.error('Error: Failed to get current tmux pane ID');
    process.exit(1);
  }

  if (!currentPaneId.startsWith('%')) {
    console.error('Error: Invalid tmux pane ID format');
    process.exit(1);
  }

  // Split pane horizontally (left: gemini, right: gemini)
  try {
    if (hasGemini) {
      // Create right pane with gemini
      console.log('Splitting pane: Left (Gemini Code) | Right (Gemini)');

      execFileSync('tmux', [
        'split-window',
        '-h',
        '-c', cwd,
        '-t', currentPaneId,
        'gemini',
      ], { stdio: 'inherit' });

      // Select left pane (original/current)
      execFileSync('tmux', ['select-pane', '-t', currentPaneId], { stdio: 'ignore' });

      console.log('\nInterop session ready!');
      console.log('- Left pane: Gemini Code (this terminal)');
      console.log('- Right pane: Gemini CLI');
      console.log('\nYou can now use interop MCP tools to communicate between the two:');
      console.log('- interop_send_task: Send tasks between tools');
      console.log('- interop_read_results: Check task results');
      console.log('- interop_send_message: Send messages');
      console.log('- interop_read_messages: Read messages');
    } else {
      // Gemini not available, just inform user
      console.log('\nGemini Code is ready in this pane.');
      console.log('Install oh-my-gemini to enable split-pane interop mode.');
      console.log('\nInstall: npm install -g @openai/gemini');
    }
  } catch (error) {
    console.error('Error creating split pane:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * CLI entry point for interop command
 */
export function interopCommand(options: { cwd?: string } = {}): void {
  const cwd = options.cwd || process.cwd();
  launchInteropSession(cwd);
}
