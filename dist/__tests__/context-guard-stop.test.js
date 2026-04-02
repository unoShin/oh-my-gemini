import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const SCRIPT_PATH = join(process.cwd(), 'scripts', 'context-guard-stop.mjs');
function runContextGuardStop(input) {
    const stdout = execSync(`node "${SCRIPT_PATH}"`, {
        input: JSON.stringify(input),
        encoding: 'utf-8',
        timeout: 5000,
        env: { ...process.env, NODE_ENV: 'test' },
    });
    return JSON.parse(stdout.trim());
}
function writeTranscriptWithContext(filePath, contextWindow, inputTokens) {
    const line = JSON.stringify({
        usage: { context_window: contextWindow, input_tokens: inputTokens },
        context_window: contextWindow,
        input_tokens: inputTokens,
    });
    writeFileSync(filePath, `${line}\n`, 'utf-8');
}
describe('context-guard-stop safe recovery messaging (issue #1373)', () => {
    let tempDir;
    let transcriptPath;
    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'context-guard-stop-'));
        transcriptPath = join(tempDir, 'transcript.jsonl');
    });
    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });
    it('blocks high-context stops with explicit compact-first recovery advice', () => {
        writeTranscriptWithContext(transcriptPath, 1000, 850); // 85%
        const out = runContextGuardStop({
            session_id: `session-${Date.now()}`,
            transcript_path: transcriptPath,
            cwd: tempDir,
            stop_reason: 'normal',
        });
        expect(out.decision).toBe('block');
        expect(String(out.reason)).toContain('Run /compact immediately');
        expect(String(out.reason)).toContain('.omg/state');
    });
    it('fails open at critical context exhaustion to avoid stop-hook deadlock', () => {
        writeTranscriptWithContext(transcriptPath, 1000, 960); // 96%
        const out = runContextGuardStop({
            session_id: `session-${Date.now()}`,
            transcript_path: transcriptPath,
            cwd: tempDir,
            stop_reason: 'end_turn',
        });
        expect(out.continue).toBe(true);
        expect(out.decision).toBeUndefined();
    });
    it('ignores invalid session_id values when tracking block retries', () => {
        writeTranscriptWithContext(transcriptPath, 1000, 850); // 85%
        const invalidSessionId = '../../bad-session-id';
        const first = runContextGuardStop({
            session_id: invalidSessionId,
            transcript_path: transcriptPath,
            cwd: tempDir,
            stop_reason: 'normal',
        });
        const second = runContextGuardStop({
            session_id: invalidSessionId,
            transcript_path: transcriptPath,
            cwd: tempDir,
            stop_reason: 'normal',
        });
        expect(first.decision).toBe('block');
        expect(second.decision).toBe('block');
        expect(String(first.reason)).toContain('(Block 1/2)');
        expect(String(second.reason)).toContain('(Block 1/2)');
    });
});
//# sourceMappingURL=context-guard-stop.test.js.map