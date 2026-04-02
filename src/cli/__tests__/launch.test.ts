import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFileSync: vi.fn(),
  };
});

vi.mock('../tmux-utils.js', () => ({
  resolveLaunchPolicy: vi.fn(),
  buildTmuxSessionName: vi.fn(() => 'test-session'),
  buildTmuxShellCommand: vi.fn((cmd: string, args: string[]) => `${cmd} ${args.join(' ')}`),
  wrapWithLoginShell: vi.fn((cmd: string) => cmd),
  isGeminiAvailable: vi.fn(() => true),
}));

import { runGemini, launchCommand, extractNotifyFlag, normalizeGeminiLaunchArgs, isPrintMode } from '../launch.js';
import {
  resolveLaunchPolicy,
} from '../tmux-utils.js';

describe('extractNotifyFlag', () => {
  it('returns notifyEnabled=true with no --notify flag', () => {
    const result = extractNotifyFlag(['--madmax']);
    expect(result.notifyEnabled).toBe(true);
    expect(result.remainingArgs).toEqual(['--madmax']);
  });

  it('disables notifications with --notify false', () => {
    const result = extractNotifyFlag(['--notify', 'false']);
    expect(result.notifyEnabled).toBe(false);
  });
});

describe('normalizeGeminiLaunchArgs', () => {
  it('maps --madmax to --dangerously-skip-permissions', () => {
    expect(normalizeGeminiLaunchArgs(['--madmax'])).toEqual([
      '--dangerously-skip-permissions',
    ]);
  });
});

describe('runGemini — exit code propagation', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  it('propagates Gemini non-zero exit code', () => {
    (resolveLaunchPolicy as ReturnType<typeof vi.fn>).mockReturnValue('direct');
    const err = Object.assign(new Error('Command failed'), { status: 2 });
    (execFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => { throw err; });

    runGemini('/tmp', [], 'sid');

    expect(processExitSpy).toHaveBeenCalledWith(2);
  });
});

describe('launchCommand — env var propagation', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    (execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(Buffer.from(''));
    (resolveLaunchPolicy as ReturnType<typeof vi.fn>).mockReturnValue('direct');
    delete process.env.OMG_NOTIFY;
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    delete process.env.OMG_NOTIFY;
  });

  it('--notify false sets OMG_NOTIFY to 0', async () => {
    await launchCommand(['--notify', 'false']);
    expect(process.env.OMG_NOTIFY).toBe('0');
  });
});
