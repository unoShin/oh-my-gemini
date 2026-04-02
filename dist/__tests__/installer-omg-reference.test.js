import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'path';
import { tmpdir } from 'os';
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    const { join: pathJoin } = await import('path');
    const repoRoot = process.cwd();
    const sourceSkillsDir = pathJoin(repoRoot, 'src', 'skills');
    const sourceGeminiMdPath = pathJoin(repoRoot, 'src', 'docs', 'GEMINI.md');
    const realSkillsDir = pathJoin(repoRoot, 'skills');
    const realGeminiMdPath = pathJoin(repoRoot, 'docs', 'GEMINI.md');
    const withRedirect = (pathLike) => {
        const normalized = String(pathLike).replace(/\\/g, '/');
        const normalizedSourceSkillsDir = sourceSkillsDir.replace(/\\/g, '/');
        const normalizedRealSkillsDir = realSkillsDir.replace(/\\/g, '/');
        if (normalized === normalizedSourceSkillsDir) {
            return realSkillsDir;
        }
        if (normalized.startsWith(`${normalizedSourceSkillsDir}/`)) {
            return normalized.replace(normalizedSourceSkillsDir, normalizedRealSkillsDir);
        }
        if (normalized === sourceGeminiMdPath.replace(/\\/g, '/')) {
            return realGeminiMdPath;
        }
        return String(pathLike);
    };
    return {
        ...actual,
        existsSync: vi.fn((pathLike) => actual.existsSync(withRedirect(pathLike))),
        readFileSync: vi.fn((pathLike, options) => actual.readFileSync(withRedirect(pathLike), options)),
        readdirSync: vi.fn((pathLike, options) => actual.readdirSync(withRedirect(pathLike), options)),
    };
});
async function loadInstallerWithEnv(geminiConfigDir, homeDir) {
    vi.resetModules();
    process.env.GEMINI_CONFIG_DIR = geminiConfigDir;
    process.env.HOME = homeDir;
    return import('../installer/index.js');
}
describe('installer omg-reference legacy skill sync (issue #1812)', () => {
    let tempRoot;
    let homeDir;
    let geminiConfigDir;
    let originalGeminiConfigDir;
    let originalHome;
    beforeEach(() => {
        tempRoot = mkdtempSync(join(tmpdir(), 'omg-installer-omg-reference-'));
        homeDir = join(tempRoot, 'home');
        geminiConfigDir = join(homeDir, '.gemini');
        mkdirSync(homeDir, { recursive: true });
        mkdirSync(geminiConfigDir, { recursive: true });
        originalGeminiConfigDir = process.env.GEMINI_CONFIG_DIR;
        originalHome = process.env.HOME;
    });
    afterEach(() => {
        if (originalGeminiConfigDir === undefined) {
            delete process.env.GEMINI_CONFIG_DIR;
        }
        else {
            process.env.GEMINI_CONFIG_DIR = originalGeminiConfigDir;
        }
        if (originalHome === undefined) {
            delete process.env.HOME;
        }
        else {
            process.env.HOME = originalHome;
        }
        rmSync(tempRoot, { recursive: true, force: true });
        vi.resetModules();
    });
    it('installs only the omg-reference skill during legacy install', async () => {
        const installer = await loadInstallerWithEnv(geminiConfigDir, homeDir);
        const result = installer.install({
            skipGeminiCheck: true,
            skipHud: true,
        });
        expect(result.success).toBe(true);
        expect(result.installedSkills).toContain('omg-reference/SKILL.md');
        const installedSkillPath = join(geminiConfigDir, 'skills', 'omg-reference', 'SKILL.md');
        expect(existsSync(installedSkillPath)).toBe(true);
        expect(readFileSync(installedSkillPath, 'utf-8')).toContain('name: omg-reference');
    });
});
//# sourceMappingURL=installer-omg-reference.test.js.map