import { describe, expect, it } from 'vitest';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { mkdtempSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseAskArgs, resolveAskAdvisorScriptPath } from '../ask.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const CLI_ENTRY = join(REPO_ROOT, 'src', 'cli', 'index.ts');
const TSX_LOADER = join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs');
const ADVISOR_SCRIPT = join(REPO_ROOT, 'scripts', 'run-provider-advisor.js');
function buildChildEnv(envOverrides = {}, options = {}) {
    if (options.preserveGeminiSessionEnv) {
        return { ...process.env, ...envOverrides };
    }
    const { GEMINICODE: _cc, ...cleanEnv } = process.env;
    return { ...cleanEnv, ...envOverrides };
}
function runCli(args, cwd, envOverrides = {}, options = {}) {
    const result = spawnSync(process.execPath, ['--import', TSX_LOADER, CLI_ENTRY, ...args], {
        cwd,
        encoding: 'utf-8',
        env: buildChildEnv(envOverrides, options),
    });
    return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error?.message,
    };
}
function runAdvisorScript(args, cwd, envOverrides = {}, options = {}) {
    const result = spawnSync(process.execPath, [ADVISOR_SCRIPT, ...args], {
        cwd,
        encoding: 'utf-8',
        env: buildChildEnv(envOverrides, options),
    });
    return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error?.message,
    };
}
function runAdvisorScriptWithPrelude(preludePath, args, cwd, envOverrides = {}, options = {}) {
    const result = spawnSync(process.execPath, ['--import', preludePath, ADVISOR_SCRIPT, ...args], {
        cwd,
        encoding: 'utf-8',
        env: buildChildEnv(envOverrides, options),
    });
    return {
        status: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error?.message,
    };
}
function writeAdvisorStub(dir) {
    const stubPath = join(dir, 'advisor-stub.js');
    writeFileSync(stubPath, [
        '#!/usr/bin/env node',
        'const payload = {',
        '  provider: process.argv[2],',
        '  prompt: process.argv[3],',
        '  originalTask: process.env.OMG_ASK_ORIGINAL_TASK ?? null,',
        '  passthrough: process.env.ASK_WRAPPER_TOKEN ?? null,',
        '};',
        'process.stdout.write(JSON.stringify(payload));',
        'if (process.env.ASK_STUB_STDERR) process.stderr.write(process.env.ASK_STUB_STDERR);',
        'process.exit(Number(process.env.ASK_STUB_EXIT_CODE || 0));',
        '',
    ].join('\n'), 'utf8');
    chmodSync(stubPath, 0o755);
    return stubPath;
}
function writeFakeProviderBinary(dir, provider) {
    const binDir = join(dir, 'bin');
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, provider);
    writeFileSync(binPath, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "fake"; exit 0; fi\nif [ "$1" = "-p" ]; then echo "FAKE_PROVIDER_OK:$2"; exit 0; fi\necho "unexpected" 1>&2\nexit 9\n', 'utf8');
    chmodSync(binPath, 0o755);
    return binDir;
}
function writeSpawnSyncCapturePrelude(dir) {
    const preludePath = join(dir, 'spawn-sync-capture-prelude.mjs');
    writeFileSync(preludePath, [
        "import childProcess from 'node:child_process';",
        "import { writeFileSync } from 'node:fs';",
        "import { syncBuiltinESMExports } from 'node:module';",
        '',
        "Object.defineProperty(process, 'platform', { value: 'win32' });",
        'const capturePath = process.env.SPAWN_CAPTURE_PATH;',
        "const mode = process.env.SPAWN_CAPTURE_MODE || 'success';",
        'const calls = [];',
        'childProcess.spawnSync = (command, args = [], options = {}) => {',
        '  calls.push({',
        '    command,',
        '    args,',
        '    options: {',
        "      shell: options.shell ?? false,",
        "      encoding: options.encoding ?? null,",
        "      stdio: options.stdio ?? null,",
        "      input: options.input ?? null,",
        '    },',
        '  });',
        "  if (mode === 'missing' && command === 'where') {",
        "    return { status: 1, stdout: '', stderr: '', pid: 0, output: [], signal: null };",
        '  }',
        "  if (mode === 'missing' && (command === 'gemini' || command === 'gemini') && Array.isArray(args) && args[0] === '--version') {",
        "    return { status: 1, stdout: '', stderr: \"'\" + command + \"' is not recognized\", pid: 0, output: [], signal: null };",
        '  }',
        "  const isVersionProbe = Array.isArray(args) && args[0] === '--version';",
        '  return {',
        '    status: 0,',
        "    stdout: isVersionProbe ? 'fake 1.0.0\\n' : 'FAKE_PROVIDER_OK',",
        "    stderr: '',",
        '    pid: 0,',
        '    output: [],',
        '    signal: null,',
        '  };',
        '};',
        'syncBuiltinESMExports();',
        'process.on(\'exit\', () => {',
        '  if (capturePath) {',
        "    writeFileSync(capturePath, JSON.stringify(calls), 'utf8');",
        '  }',
        '});',
        '',
    ].join('\n'), 'utf8');
    return preludePath;
}
function writeFakeGeminiBinary(dir) {
    const binDir = join(dir, 'bin');
    mkdirSync(binDir, { recursive: true });
    const binPath = join(binDir, 'gemini');
    writeFileSync(binPath, `#!/bin/sh
if [ "$1" = "--version" ]; then echo "fake"; exit 0; fi
if [ "$1" = "exec" ]; then
  echo "GEMINI_OK"
  if [ -n "\${RUST_LOG:-}" ] || [ -n "\${RUST_BACKTRACE:-}" ]; then
    echo "RUST_LEAK:\${RUST_LOG:-}:\${RUST_BACKTRACE:-}" 1>&2
  fi
  exit 0
fi
echo "unexpected" 1>&2
exit 9
`, 'utf8');
    chmodSync(binPath, 0o755);
    return binDir;
}
describe('parseAskArgs', () => {
    it('supports positional and print/prompt flag forms', () => {
        expect(parseAskArgs(['gemini', 'review', 'this'])).toEqual({ provider: 'gemini', prompt: 'review this' });
        expect(parseAskArgs(['gemini', '-p', 'brainstorm'])).toEqual({ provider: 'gemini', prompt: 'brainstorm' });
        expect(parseAskArgs(['gemini', '--print', 'draft', 'summary'])).toEqual({ provider: 'gemini', prompt: 'draft summary' });
        expect(parseAskArgs(['gemini', '--prompt=ship safely'])).toEqual({ provider: 'gemini', prompt: 'ship safely' });
        expect(parseAskArgs(['gemini', 'review', 'this'])).toEqual({ provider: 'gemini', prompt: 'review this' });
    });
    it('supports --agent-prompt flag and equals syntax', () => {
        expect(parseAskArgs(['gemini', '--agent-prompt', 'executor', 'do', 'it'])).toEqual({
            provider: 'gemini',
            prompt: 'do it',
            agentPromptRole: 'executor',
        });
        expect(parseAskArgs(['gemini', '--agent-prompt=planner', '--prompt', 'plan', 'it'])).toEqual({
            provider: 'gemini',
            prompt: 'plan it',
            agentPromptRole: 'planner',
        });
    });
    it('rejects unsupported provider matrix', () => {
        expect(() => parseAskArgs(['openai', 'hi'])).toThrow(/Invalid provider/i);
    });
});
describe('omg ask command', () => {
    it('accepts canonical advisor env and forwards prompt/task to advisor', () => {
        const wd = mkdtempSync(join(tmpdir(), 'omg-ask-canonical-'));
        try {
            const stubPath = writeAdvisorStub(wd);
            const result = runCli(['ask', 'gemini', '--print', 'hello world'], wd, { OMG_ASK_ADVISOR_SCRIPT: stubPath });
            expect(result.error).toBeUndefined();
            expect(result.status).toBe(0);
            expect(result.stderr).toBe('');
            const payload = JSON.parse(result.stdout);
            expect(payload).toEqual({
                provider: 'gemini',
                prompt: 'hello world',
                originalTask: 'hello world',
                passthrough: null,
            });
        }
        finally {
            rmSync(wd, { recursive: true, force: true });
        }
    });
    it('accepts OMX advisor env alias in Phase-1 and emits deprecation warning', () => {
        const wd = mkdtempSync(join(tmpdir(), 'omg-ask-alias-'));
        try {
            const stubPath = writeAdvisorStub(wd);
            const result = runCli(['ask', 'gemini', 'legacy', 'path'], wd, { OMX_ASK_ADVISOR_SCRIPT: stubPath });
            expect(result.error).toBeUndefined();
            expect(result.status).toBe(0);
            expect(result.stderr).toContain('DEPRECATED');
            expect(result.stderr).toContain('OMX_ASK_ADVISOR_SCRIPT');
            const payload = JSON.parse(result.stdout);
            expect(payload.provider).toBe('gemini');
            expect(payload.prompt).toBe('legacy path');
            expect(payload.originalTask).toBe('legacy path');
        }
        finally {
            rmSync(wd, { recursive: true, force: true });
        }
    });
    it('allows gemini ask inside a Gemini Code session', () => {
        const wd = mkdtempSync(join(tmpdir(), 'omg-ask-cli-gemini-nested-'));
        try {
            const stubPath = writeAdvisorStub(wd);
            const result = runCli(['ask', 'gemini', '--prompt', 'cli nested gemini prompt'], wd, {
                OMG_ASK_ADVISOR_SCRIPT: stubPath,
                GEMINICODE: '1',
            }, { preserveGeminiSessionEnv: true });
            expect(result.error).toBeUndefined();
            expect(result.status).toBe(0);
            expect(result.stderr).not.toContain('Nested launches are not supported');
            const payload = JSON.parse(result.stdout);
            expect(payload).toEqual({
                provider: 'gemini',
                prompt: 'cli nested gemini prompt',
                originalTask: 'cli nested gemini prompt',
                passthrough: null,
            });
        }
        finally {
            rmSync(wd, { recursive: true, force: true });
        }
    });
    it('allows gemini ask inside a Gemini Code session', () => {
        const wd = mkdtempSync(join(tmpdir(), 'omg-ask-cli-gemini-nested-'));
        try {
            const stubPath = writeAdvisorStub(wd);
            const result = runCli(['ask', 'gemini', '--prompt', 'cli nested gemini prompt'], wd, {
                OMG_ASK_ADVISOR_SCRIPT: stubPath,
                GEMINICODE: '1',
            }, { preserveGeminiSessionEnv: true });
            expect(result.error).toBeUndefined();
            expect(result.status).toBe(0);
            expect(result.stderr).not.toContain('Nested launches are not supported');
            const payload = JSON.parse(result.stdout);
            expect(payload.provider).toBe('gemini');
            expect(payload.prompt).toBe('cli nested gemini prompt');
            expect(payload.originalTask).toBe('cli nested gemini prompt');
            expect(payload.passthrough).toBeNull();
        }
        finally {
            rmSync(wd, { recursive: true, force: true });
        }
    });
    it('loads --agent-prompt role from resolved prompts dir and prepends role content', () => {
        const wd = mkdtempSync(join(tmpdir(), 'omg-ask-agent-prompt-'));
        try {
            const stubPath = writeAdvisorStub(wd);
            mkdirSync(join(wd, '.omx'), { recursive: true });
            mkdirSync(join(wd, '.gemini', 'prompts'), { recursive: true });
            writeFileSync(join(wd, '.omx', 'setup-scope.json'), JSON.stringify({ scope: 'project' }), 'utf8');
            writeFileSync(join(wd, '.gemini', 'prompts', 'executor.md'), 'ROLE HEADER\nFollow checks.', 'utf8');
            const result = runCli(['ask', 'gemini', '--agent-prompt=executor', '--prompt', 'ship feature'], wd, { OMG_ASK_ADVISOR_SCRIPT: stubPath });
            expect(result.error).toBeUndefined();
            expect(result.status).toBe(0);
            const payload = JSON.parse(result.stdout);
            expect(payload.originalTask).toBe('ship feature');
            expect(payload.prompt).toContain('ROLE HEADER');
            expect(payload.prompt).toContain('ship feature');
        }
        finally {
            rmSync(wd, { recursive: true, force: true });
        }
    });
});
describe('resolveAskAdvisorScriptPath', () => {
    it('resolves canonical env and supports package-root relative paths', () => {
        const packageRoot = '/tmp/pkg-root';
        expect(resolveAskAdvisorScriptPath(packageRoot, { OMG_ASK_ADVISOR_SCRIPT: 'scripts/custom.js' }))
            .toBe('/tmp/pkg-root/scripts/custom.js');
        expect(resolveAskAdvisorScriptPath(packageRoot, { OMG_ASK_ADVISOR_SCRIPT: '/opt/custom.js' }))
            .toBe('/opt/custom.js');
    });
});
//# sourceMappingURL=ask.test.js.map