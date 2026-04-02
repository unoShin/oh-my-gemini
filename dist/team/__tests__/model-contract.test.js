import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'child_process';
import { getContract, buildLaunchArgs, buildWorkerArgv, getWorkerEnv, parseCliOutput, isPromptModeAgent, getPromptModeArgs, isCliAvailable, shouldLoadShellRc, resolveCliBinaryPath, clearResolvedPathCache, validateCliBinaryPath, resolveGeminiWorkerModel, _testInternals, } from '../model-contract.js';
vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        spawnSync: vi.fn(actual.spawnSync),
    };
});
function setProcessPlatform(platform) {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    return () => {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    };
}
describe('model-contract', () => {
    describe('backward-compat API shims', () => {
        it('shouldLoadShellRc returns false for non-interactive compatibility mode', () => {
            expect(shouldLoadShellRc()).toBe(false);
        });
        it('resolveCliBinaryPath resolves and caches paths', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            mockSpawnSync.mockReturnValue({ status: 0, stdout: '/usr/local/bin/gemini\n', stderr: '', pid: 0, output: [], signal: null });
            clearResolvedPathCache();
            expect(resolveCliBinaryPath('gemini')).toBe('/usr/local/bin/gemini');
            expect(resolveCliBinaryPath('gemini')).toBe('/usr/local/bin/gemini');
            expect(mockSpawnSync).toHaveBeenCalledTimes(1);
            clearResolvedPathCache();
        });
        it('resolveCliBinaryPath rejects unsafe names and paths', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            expect(() => resolveCliBinaryPath('../evil')).toThrow('Invalid CLI binary name');
            mockSpawnSync.mockReturnValue({ status: 0, stdout: '/tmp/evil/gemini\n', stderr: '', pid: 0, output: [], signal: null });
            clearResolvedPathCache();
            expect(() => resolveCliBinaryPath('gemini')).toThrow('untrusted location');
            clearResolvedPathCache();
            mockSpawnSync.mockRestore();
        });
        it('validateCliBinaryPath returns compatibility result object', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            mockSpawnSync.mockReturnValue({ status: 0, stdout: '/usr/local/bin/gemini\n', stderr: '', pid: 0, output: [], signal: null });
            clearResolvedPathCache();
            expect(validateCliBinaryPath('gemini')).toEqual({
                valid: true,
                binary: 'gemini',
                resolvedPath: '/usr/local/bin/gemini',
            });
            mockSpawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'not found', pid: 0, output: [], signal: null });
            clearResolvedPathCache();
            const invalid = validateCliBinaryPath('missing-cli');
            expect(invalid.valid).toBe(false);
            expect(invalid.binary).toBe('missing-cli');
            expect(invalid.reason).toContain('not found in PATH');
            clearResolvedPathCache();
            mockSpawnSync.mockRestore();
        });
        it('exposes compatibility test internals for path policy', () => {
            expect(_testInternals.UNTRUSTED_PATH_PATTERNS.some(p => p.test('/tmp/evil'))).toBe(true);
            expect(_testInternals.UNTRUSTED_PATH_PATTERNS.some(p => p.test('/usr/local/bin/gemini'))).toBe(false);
            const prefixes = _testInternals.getTrustedPrefixes();
            expect(prefixes).toContain('/usr/local/bin');
            expect(prefixes).toContain('/usr/bin');
        });
    });
    describe('getContract', () => {
        it('returns contract for gemini', () => {
            const c = getContract('gemini');
            expect(c.agentType).toBe('gemini');
            expect(c.binary).toBe('gemini');
        });
        it('returns contract for gemini', () => {
            const c = getContract('gemini');
            expect(c.agentType).toBe('gemini');
            expect(c.binary).toBe('gemini');
        });
        it('returns contract for gemini', () => {
            const c = getContract('gemini');
            expect(c.agentType).toBe('gemini');
            expect(c.binary).toBe('gemini');
        });
        it('throws for unknown agent type', () => {
            expect(() => getContract('unknown')).toThrow('Unknown agent type');
        });
    });
    describe('buildLaunchArgs', () => {
        it('gemini includes --dangerously-skip-permissions', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp' });
            expect(args).toContain('--dangerously-skip-permissions');
        });
        it('gemini includes --dangerously-bypass-approvals-and-sandbox', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp' });
            expect(args).not.toContain('--full-auto');
            expect(args).toContain('--dangerously-bypass-approvals-and-sandbox');
        });
        it('gemini includes --approval-mode yolo', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp' });
            expect(args).toContain('--approval-mode');
            expect(args).toContain('yolo');
            expect(args).not.toContain('-i');
        });
        it('passes model flag when specified', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp', model: 'gpt-4' });
            expect(args).toContain('--model');
            expect(args).toContain('gpt-4');
        });
        it('normalizes full Gemini model ID to alias for gemini agent (issue #1415)', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp', model: 'gemini-pro-4-6' });
            expect(args).toContain('--model');
            expect(args).toContain('pro');
            expect(args).not.toContain('gemini-pro-4-6');
        });
        it('passes Bedrock model ID through without normalization for gemini agent (issue #1695)', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp', model: 'us.anthropic.gemini-ultra-4-6-v1:0' });
            expect(args).toContain('--model');
            expect(args).toContain('us.anthropic.gemini-ultra-4-6-v1:0');
            expect(args).not.toContain('ultra');
        });
        it('passes Bedrock ARN model ID through without normalization (issue #1695)', () => {
            const arn = 'arn:aws:bedrock:us-east-2:123456789012:inference-profile/global.anthropic.gemini-pro-4-6-v1:0';
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp', model: arn });
            expect(args).toContain('--model');
            expect(args).toContain(arn);
        });
        it('passes Vertex AI model ID through without normalization (issue #1695)', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp', model: 'vertex_ai/gemini-pro-4-6@20250514' });
            expect(args).toContain('--model');
            expect(args).toContain('vertex_ai/gemini-pro-4-6@20250514');
            expect(args).not.toContain('pro');
        });
        it('does not normalize non-Gemini models for gemini/gemini agents', () => {
            const args = buildLaunchArgs('gemini', { teamName: 't', workerName: 'w', cwd: '/tmp', model: 'gpt-4o' });
            expect(args).toContain('gpt-4o');
        });
    });
    describe('getWorkerEnv', () => {
        it('returns correct env vars', () => {
            const env = getWorkerEnv('my-team', 'worker-1', 'gemini');
            expect(env.OMG_TEAM_WORKER).toBe('my-team/worker-1');
            expect(env.OMG_TEAM_NAME).toBe('my-team');
            expect(env.OMG_WORKER_AGENT_TYPE).toBe('gemini');
        });
        it('propagates allowlisted model selection env vars into worker startup env', () => {
            const env = getWorkerEnv('my-team', 'worker-1', 'gemini', {
                ANTHROPIC_MODEL: 'gemini-ultra-4-1',
                GEMINI_MODEL: 'gemini-pro-4-5',
                ANTHROPIC_BASE_URL: 'https://example-gateway.invalid',
                GEMINI_CODE_USE_BEDROCK: '1',
                GEMINI_CODE_BEDROCK_ULTRA_MODEL: 'us.anthropic.gemini-ultra-4-6-v1:0',
                GEMINI_CODE_BEDROCK_PRO_MODEL: 'us.anthropic.gemini-pro-4-6-v1:0',
                GEMINI_CODE_BEDROCK_FLASH_MODEL: 'us.anthropic.gemini-flash-4-5-v1:0',
                ANTHROPIC_DEFAULT_ULTRA_MODEL: 'gemini-ultra-4-6-custom',
                ANTHROPIC_DEFAULT_PRO_MODEL: 'gemini-pro-4-6-custom',
                ANTHROPIC_DEFAULT_FLASH_MODEL: 'gemini-flash-4-5-custom',
                OMG_MODEL_HIGH: 'gemini-ultra-4-6-override',
                OMG_MODEL_MEDIUM: 'gemini-pro-4-6-override',
                OMG_MODEL_LOW: 'gemini-flash-4-5-override',
                OMG_EXTERNAL_MODELS_DEFAULT_GEMINI_MODEL: 'gpt-5',
                OMG_GEMINI_DEFAULT_MODEL: 'gemini-2.5-pro',
                ANTHROPIC_API_KEY: 'should-not-be-forwarded',
            });
            expect(env.ANTHROPIC_MODEL).toBe('gemini-ultra-4-1');
            expect(env.GEMINI_MODEL).toBe('gemini-pro-4-5');
            expect(env.ANTHROPIC_BASE_URL).toBe('https://example-gateway.invalid');
            expect(env.GEMINI_CODE_USE_BEDROCK).toBe('1');
            expect(env.GEMINI_CODE_BEDROCK_ULTRA_MODEL).toBe('us.anthropic.gemini-ultra-4-6-v1:0');
            expect(env.GEMINI_CODE_BEDROCK_PRO_MODEL).toBe('us.anthropic.gemini-pro-4-6-v1:0');
            expect(env.GEMINI_CODE_BEDROCK_FLASH_MODEL).toBe('us.anthropic.gemini-flash-4-5-v1:0');
            expect(env.ANTHROPIC_DEFAULT_ULTRA_MODEL).toBe('gemini-ultra-4-6-custom');
            expect(env.ANTHROPIC_DEFAULT_PRO_MODEL).toBe('gemini-pro-4-6-custom');
            expect(env.ANTHROPIC_DEFAULT_FLASH_MODEL).toBe('gemini-flash-4-5-custom');
            expect(env.OMG_MODEL_HIGH).toBe('gemini-ultra-4-6-override');
            expect(env.OMG_MODEL_MEDIUM).toBe('gemini-pro-4-6-override');
            expect(env.OMG_MODEL_LOW).toBe('gemini-flash-4-5-override');
            expect(env.OMG_EXTERNAL_MODELS_DEFAULT_GEMINI_MODEL).toBe('gpt-5');
            expect(env.OMG_GEMINI_DEFAULT_MODEL).toBe('gemini-2.5-pro');
            expect(env.ANTHROPIC_API_KEY).toBeUndefined();
        });
        it('rejects invalid team names', () => {
            expect(() => getWorkerEnv('Bad-Team', 'worker-1', 'gemini')).toThrow('Invalid team name');
        });
    });
    describe('buildWorkerArgv', () => {
        it('builds binary + args', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            mockSpawnSync.mockReturnValueOnce({ status: 1, stdout: '', stderr: '', pid: 0, output: [], signal: null });
            expect(buildWorkerArgv('gemini', { teamName: 'my-team', workerName: 'worker-1', cwd: '/tmp' })).toEqual([
                'gemini',
                '--dangerously-bypass-approvals-and-sandbox',
            ]);
            expect(mockSpawnSync).toHaveBeenCalledWith('which', ['gemini'], { timeout: 5000, encoding: 'utf8' });
            mockSpawnSync.mockRestore();
        });
        it('prefers resolved absolute binary path when available', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            mockSpawnSync.mockReturnValueOnce({ status: 0, stdout: '/usr/local/bin/gemini\n', stderr: '', pid: 0, output: [], signal: null });
            expect(buildWorkerArgv('gemini', { teamName: 'my-team', workerName: 'worker-1', cwd: '/tmp' })[0]).toBe('/usr/local/bin/gemini');
            mockSpawnSync.mockRestore();
        });
    });
    describe('parseCliOutput', () => {
        it('gemini returns trimmed output', () => {
            expect(parseCliOutput('gemini', '  hello  ')).toBe('hello');
        });
        it('gemini extracts result from JSONL', () => {
            const jsonl = JSON.stringify({ type: 'result', output: 'the answer' });
            expect(parseCliOutput('gemini', jsonl)).toBe('the answer');
        });
        it('gemini falls back to raw output if no JSONL', () => {
            expect(parseCliOutput('gemini', 'plain text')).toBe('plain text');
        });
    });
    describe('isCliAvailable', () => {
        it('checks version without shell:true for standard binaries', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            clearResolvedPathCache();
            mockSpawnSync
                .mockReturnValueOnce({ status: 1, stdout: '', stderr: '', pid: 0, output: [], signal: null })
                .mockReturnValueOnce({ status: 0, stdout: '', stderr: '', pid: 0, output: [], signal: null });
            isCliAvailable('gemini');
            expect(mockSpawnSync).toHaveBeenNthCalledWith(1, 'which', ['gemini'], { timeout: 5000, encoding: 'utf8' });
            expect(mockSpawnSync).toHaveBeenNthCalledWith(2, 'gemini', ['--version'], { timeout: 5000, shell: false });
            clearResolvedPathCache();
            mockSpawnSync.mockRestore();
        });
        it('uses COMSPEC for .cmd binaries on win32', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            const restorePlatform = setProcessPlatform('win32');
            vi.stubEnv('COMSPEC', 'C:\\Windows\\System32\\cmd.exe');
            clearResolvedPathCache();
            mockSpawnSync
                .mockReturnValueOnce({ status: 0, stdout: 'C:\\Tools\\gemini.cmd\n', stderr: '', pid: 0, output: [], signal: null })
                .mockReturnValueOnce({ status: 0, stdout: '', stderr: '', pid: 0, output: [], signal: null });
            isCliAvailable('gemini');
            expect(mockSpawnSync).toHaveBeenNthCalledWith(1, 'where', ['gemini'], { timeout: 5000, encoding: 'utf8' });
            expect(mockSpawnSync).toHaveBeenNthCalledWith(2, 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', '"C:\\Tools\\gemini.cmd" --version'], { timeout: 5000 });
            restorePlatform();
            clearResolvedPathCache();
            mockSpawnSync.mockRestore();
            vi.unstubAllEnvs();
        });
        it('uses shell:true for unresolved binaries on win32', () => {
            const mockSpawnSync = vi.mocked(spawnSync);
            const restorePlatform = setProcessPlatform('win32');
            clearResolvedPathCache();
            mockSpawnSync
                .mockReturnValueOnce({ status: 1, stdout: '', stderr: '', pid: 0, output: [], signal: null })
                .mockReturnValueOnce({ status: 0, stdout: '', stderr: '', pid: 0, output: [], signal: null });
            isCliAvailable('gemini');
            expect(mockSpawnSync).toHaveBeenNthCalledWith(1, 'where', ['gemini'], { timeout: 5000, encoding: 'utf8' });
            expect(mockSpawnSync).toHaveBeenNthCalledWith(2, 'gemini', ['--version'], { timeout: 5000, shell: true });
            restorePlatform();
            clearResolvedPathCache();
            mockSpawnSync.mockRestore();
        });
    });
    describe('prompt mode (headless TUI bypass)', () => {
        it('gemini supports prompt mode', () => {
            expect(isPromptModeAgent('gemini')).toBe(true);
            const c = getContract('gemini');
            expect(c.supportsPromptMode).toBe(true);
            expect(c.promptModeFlag).toBe('-i');
        });
        it('gemini does not support prompt mode', () => {
            expect(isPromptModeAgent('gemini')).toBe(false);
        });
        it('gemini supports prompt mode (positional argument, no flag)', () => {
            expect(isPromptModeAgent('gemini')).toBe(true);
            const c = getContract('gemini');
            expect(c.supportsPromptMode).toBe(true);
            expect(c.promptModeFlag).toBeUndefined();
        });
        it('getPromptModeArgs returns flag + instruction for gemini', () => {
            const args = getPromptModeArgs('gemini', 'Read inbox');
            expect(args).toEqual(['-i', 'Read inbox']);
        });
        it('getPromptModeArgs returns instruction only (positional) for gemini', () => {
            const args = getPromptModeArgs('gemini', 'Read inbox');
            expect(args).toEqual(['Read inbox']);
        });
        it('getPromptModeArgs returns empty array for non-prompt-mode agents', () => {
            expect(getPromptModeArgs('gemini', 'Read inbox')).toEqual([]);
        });
    });
    describe('resolveGeminiWorkerModel (issue #1695)', () => {
        it('returns undefined when not on Bedrock or Vertex', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '');
            vi.stubEnv('GEMINI_CODE_USE_VERTEX', '');
            vi.stubEnv('ANTHROPIC_MODEL', '');
            vi.stubEnv('GEMINI_MODEL', '');
            expect(resolveGeminiWorkerModel()).toBeUndefined();
            vi.unstubAllEnvs();
        });
        it('returns ANTHROPIC_MODEL on Bedrock when set', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '1');
            vi.stubEnv('ANTHROPIC_MODEL', 'us.anthropic.gemini-pro-4-5-20250929-v1:0');
            vi.stubEnv('GEMINI_MODEL', '');
            expect(resolveGeminiWorkerModel()).toBe('us.anthropic.gemini-pro-4-5-20250929-v1:0');
            vi.unstubAllEnvs();
        });
        it('returns GEMINI_MODEL on Bedrock when ANTHROPIC_MODEL is not set', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '1');
            vi.stubEnv('ANTHROPIC_MODEL', '');
            vi.stubEnv('GEMINI_MODEL', 'us.anthropic.gemini-ultra-4-6-v1:0');
            expect(resolveGeminiWorkerModel()).toBe('us.anthropic.gemini-ultra-4-6-v1:0');
            vi.unstubAllEnvs();
        });
        it('falls back to GEMINI_CODE_BEDROCK_PRO_MODEL tier env var', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '1');
            vi.stubEnv('ANTHROPIC_MODEL', '');
            vi.stubEnv('GEMINI_MODEL', '');
            vi.stubEnv('GEMINI_CODE_BEDROCK_PRO_MODEL', 'us.anthropic.gemini-pro-4-6-v1:0');
            expect(resolveGeminiWorkerModel()).toBe('us.anthropic.gemini-pro-4-6-v1:0');
            vi.unstubAllEnvs();
        });
        it('falls back to OMG_MODEL_MEDIUM tier env var', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '1');
            vi.stubEnv('ANTHROPIC_MODEL', '');
            vi.stubEnv('GEMINI_MODEL', '');
            vi.stubEnv('GEMINI_CODE_BEDROCK_PRO_MODEL', '');
            vi.stubEnv('ANTHROPIC_DEFAULT_PRO_MODEL', '');
            vi.stubEnv('OMG_MODEL_MEDIUM', 'us.anthropic.gemini-pro-4-5-20250929-v1:0');
            expect(resolveGeminiWorkerModel()).toBe('us.anthropic.gemini-pro-4-5-20250929-v1:0');
            vi.unstubAllEnvs();
        });
        it('returns ANTHROPIC_MODEL on Vertex when set', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '');
            vi.stubEnv('GEMINI_CODE_USE_VERTEX', '1');
            vi.stubEnv('ANTHROPIC_MODEL', 'vertex_ai/gemini-pro-4-6@20250514');
            expect(resolveGeminiWorkerModel()).toBe('vertex_ai/gemini-pro-4-6@20250514');
            vi.unstubAllEnvs();
        });
        it('returns undefined on Bedrock when no model env vars are set', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '1');
            vi.stubEnv('ANTHROPIC_MODEL', '');
            vi.stubEnv('GEMINI_MODEL', '');
            vi.stubEnv('GEMINI_CODE_BEDROCK_PRO_MODEL', '');
            vi.stubEnv('ANTHROPIC_DEFAULT_PRO_MODEL', '');
            vi.stubEnv('OMG_MODEL_MEDIUM', '');
            expect(resolveGeminiWorkerModel()).toBeUndefined();
            vi.unstubAllEnvs();
        });
        it('detects Bedrock from model ID pattern even without GEMINI_CODE_USE_BEDROCK', () => {
            vi.stubEnv('GEMINI_CODE_USE_BEDROCK', '');
            vi.stubEnv('GEMINI_CODE_USE_VERTEX', '');
            vi.stubEnv('ANTHROPIC_MODEL', 'us.anthropic.gemini-pro-4-5-20250929-v1:0');
            vi.stubEnv('GEMINI_MODEL', '');
            // isBedrock() detects Bedrock from the model ID pattern
            expect(resolveGeminiWorkerModel()).toBe('us.anthropic.gemini-pro-4-5-20250929-v1:0');
            vi.unstubAllEnvs();
        });
    });
});
//# sourceMappingURL=model-contract.test.js.map