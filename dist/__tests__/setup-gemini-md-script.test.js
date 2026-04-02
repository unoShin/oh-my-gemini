import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const REPO_ROOT = join(__dirname, '..', '..');
const SETUP_SCRIPT = join(REPO_ROOT, 'scripts', 'setup-gemini-md.sh');
const tempRoots = [];
function createPluginFixture(geminiMdContent) {
    const root = mkdtempSync(join(tmpdir(), 'omg-setup-gemini-md-'));
    tempRoots.push(root);
    const pluginRoot = join(root, 'plugin');
    const projectRoot = join(root, 'project');
    const homeRoot = join(root, 'home');
    mkdirSync(join(pluginRoot, 'scripts'), { recursive: true });
    mkdirSync(join(pluginRoot, 'docs'), { recursive: true });
    mkdirSync(join(pluginRoot, 'skills', 'omg-reference'), { recursive: true });
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(homeRoot, { recursive: true });
    copyFileSync(SETUP_SCRIPT, join(pluginRoot, 'scripts', 'setup-gemini-md.sh'));
    writeFileSync(join(pluginRoot, 'docs', 'GEMINI.md'), geminiMdContent);
    writeFileSync(join(pluginRoot, 'skills', 'omg-reference', 'SKILL.md'), `---
name: omg-reference
description: Test fixture reference skill
user-invocable: false
---

# Test OMG Reference
`);
    return {
        pluginRoot,
        projectRoot,
        homeRoot,
        scriptPath: join(pluginRoot, 'scripts', 'setup-gemini-md.sh'),
    };
}
afterEach(() => {
    while (tempRoots.length > 0) {
        const root = tempRoots.pop();
        if (root) {
            rmSync(root, { recursive: true, force: true });
        }
    }
});
describe('setup-gemini-md.sh (issue #1572)', () => {
    it('installs the canonical docs/GEMINI.md content with OMG markers', () => {
        const fixture = createPluginFixture(`<!-- OMG:START -->
<!-- OMG:VERSION:9.9.9 -->

# Canonical GEMINI
Use the real docs file.
<!-- OMG:END -->
`);
        const result = spawnSync('bash', [fixture.scriptPath, 'local'], {
            cwd: fixture.projectRoot,
            env: {
                ...process.env,
                HOME: fixture.homeRoot,
            },
            encoding: 'utf-8',
        });
        expect(result.status).toBe(0);
        const installedPath = join(fixture.projectRoot, '.gemini', 'GEMINI.md');
        expect(existsSync(installedPath)).toBe(true);
        const installed = readFileSync(installedPath, 'utf-8');
        expect(installed).toContain('<!-- OMG:START -->');
        expect(installed).toContain('<!-- OMG:END -->');
        expect(installed).toContain('<!-- OMG:VERSION:9.9.9 -->');
        expect(installed).toContain('# Canonical GEMINI');
        const installedSkillPath = join(fixture.projectRoot, '.gemini', 'skills', 'omg-reference', 'SKILL.md');
        expect(existsSync(installedSkillPath)).toBe(true);
        expect(readFileSync(installedSkillPath, 'utf-8')).toContain('# Test OMG Reference');
    });
    it('refuses to install a canonical source that lacks OMG markers', () => {
        const fixture = createPluginFixture(`# oh-my-gemini (OMG) v9.9.9 Summary

This is a summarized GEMINI.md without markers.
`);
        const result = spawnSync('bash', [fixture.scriptPath, 'local'], {
            cwd: fixture.projectRoot,
            env: {
                ...process.env,
                HOME: fixture.homeRoot,
            },
            encoding: 'utf-8',
        });
        expect(result.status).not.toBe(0);
        expect(`${result.stdout}\n${result.stderr}`).toContain('missing required OMG markers');
        expect(existsSync(join(fixture.projectRoot, '.gemini', 'GEMINI.md'))).toBe(false);
    });
    it('adds a local git exclude block for .omg artifacts while preserving .omg/skills', () => {
        const fixture = createPluginFixture(`<!-- OMG:START -->
<!-- OMG:VERSION:9.9.9 -->

# Canonical GEMINI
Use the real docs file.
<!-- OMG:END -->
`);
        const gitInit = spawnSync('git', ['init'], {
            cwd: fixture.projectRoot,
            env: {
                ...process.env,
                HOME: fixture.homeRoot,
            },
            encoding: 'utf-8',
        });
        expect(gitInit.status).toBe(0);
        const result = spawnSync('bash', [fixture.scriptPath, 'local'], {
            cwd: fixture.projectRoot,
            env: {
                ...process.env,
                HOME: fixture.homeRoot,
            },
            encoding: 'utf-8',
        });
        expect(result.status).toBe(0);
        const excludePath = join(fixture.projectRoot, '.git', 'info', 'exclude');
        expect(existsSync(excludePath)).toBe(true);
        const excludeContents = readFileSync(excludePath, 'utf-8');
        expect(excludeContents).toContain('# BEGIN OMG local artifacts');
        expect(excludeContents).toContain('.omg/*');
        expect(excludeContents).toContain('!.omg/skills/');
        expect(excludeContents).toContain('!.omg/skills/**');
        expect(excludeContents).toContain('# END OMG local artifacts');
    });
    it('does not duplicate the local git exclude block on repeated local setup runs', () => {
        const fixture = createPluginFixture(`<!-- OMG:START -->
<!-- OMG:VERSION:9.9.9 -->

# Canonical GEMINI
Use the real docs file.
<!-- OMG:END -->
`);
        const gitInit = spawnSync('git', ['init'], {
            cwd: fixture.projectRoot,
            env: {
                ...process.env,
                HOME: fixture.homeRoot,
            },
            encoding: 'utf-8',
        });
        expect(gitInit.status).toBe(0);
        const firstRun = spawnSync('bash', [fixture.scriptPath, 'local'], {
            cwd: fixture.projectRoot,
            env: {
                ...process.env,
                HOME: fixture.homeRoot,
            },
            encoding: 'utf-8',
        });
        expect(firstRun.status).toBe(0);
        const secondRun = spawnSync('bash', [fixture.scriptPath, 'local'], {
            cwd: fixture.projectRoot,
            env: {
                ...process.env,
                HOME: fixture.homeRoot,
            },
            encoding: 'utf-8',
        });
        expect(secondRun.status).toBe(0);
        const excludeContents = readFileSync(join(fixture.projectRoot, '.git', 'info', 'exclude'), 'utf-8');
        expect(excludeContents.match(/# BEGIN OMG local artifacts/g)).toHaveLength(1);
    });
});
describe('setup-gemini-md.sh stale GEMINI_PLUGIN_ROOT resolution', () => {
    it('uses docs/GEMINI.md from the active version in installed_plugins.json, not the stale script location', () => {
        // Simulate: script lives at old version (4.8.2), but installed_plugins.json points to new version (4.9.0)
        const root = mkdtempSync(join(tmpdir(), 'omg-stale-root-'));
        tempRoots.push(root);
        const cacheBase = join(root, '.gemini', 'plugins', 'cache', 'omg', 'oh-my-gemini');
        const oldVersion = join(cacheBase, '4.8.2');
        const newVersion = join(cacheBase, '4.9.0');
        const projectRoot = join(root, 'project');
        const homeRoot = join(root, 'home');
        // Create old version (where the script will be copied)
        mkdirSync(join(oldVersion, 'scripts'), { recursive: true });
        mkdirSync(join(oldVersion, 'docs'), { recursive: true });
        copyFileSync(SETUP_SCRIPT, join(oldVersion, 'scripts', 'setup-gemini-md.sh'));
        writeFileSync(join(oldVersion, 'docs', 'GEMINI.md'), `<!-- OMG:START -->\n<!-- OMG:VERSION:4.8.2 -->\n\n# Old Version\n<!-- OMG:END -->\n`);
        // Create new version (the active one)
        mkdirSync(join(newVersion, 'docs'), { recursive: true });
        writeFileSync(join(newVersion, 'docs', 'GEMINI.md'), `<!-- OMG:START -->\n<!-- OMG:VERSION:4.9.0 -->\n\n# New Version\n<!-- OMG:END -->\n`);
        // Create installed_plugins.json pointing to the new version
        mkdirSync(join(homeRoot, '.gemini', 'plugins'), { recursive: true });
        writeFileSync(join(homeRoot, '.gemini', 'plugins', 'installed_plugins.json'), JSON.stringify({
            'oh-my-gemini@omg': [
                {
                    installPath: newVersion,
                    version: '4.9.0',
                },
            ],
        }));
        // Create project dir and settings.json (needed for plugin verification)
        mkdirSync(projectRoot, { recursive: true });
        mkdirSync(join(homeRoot, '.gemini'), { recursive: true });
        writeFileSync(join(homeRoot, '.gemini', 'settings.json'), JSON.stringify({ plugins: ['oh-my-gemini'] }));
        // Run the OLD version's script — it should resolve to the NEW version's docs/GEMINI.md
        const result = spawnSync('bash', [join(oldVersion, 'scripts', 'setup-gemini-md.sh'), 'local'], {
            cwd: projectRoot,
            env: {
                ...process.env,
                HOME: homeRoot,
                GEMINI_CONFIG_DIR: join(homeRoot, '.gemini'),
            },
            encoding: 'utf-8',
        });
        expect(result.status).toBe(0);
        const installed = readFileSync(join(projectRoot, '.gemini', 'GEMINI.md'), 'utf-8');
        // Should contain the NEW version, not the old one
        expect(installed).toContain('<!-- OMG:VERSION:4.9.0 -->');
        expect(installed).toContain('# New Version');
        expect(installed).not.toContain('<!-- OMG:VERSION:4.8.2 -->');
    });
    it('uses docs/GEMINI.md from the active version when installed_plugins.json wraps plugins under a plugins key', () => {
        const root = mkdtempSync(join(tmpdir(), 'omg-stale-wrapped-root-'));
        tempRoots.push(root);
        const cacheBase = join(root, '.gemini', 'plugins', 'cache', 'omg', 'oh-my-gemini');
        const oldVersion = join(cacheBase, '4.8.2');
        const newVersion = join(cacheBase, '4.9.0');
        const projectRoot = join(root, 'project');
        const homeRoot = join(root, 'home');
        mkdirSync(join(oldVersion, 'scripts'), { recursive: true });
        mkdirSync(join(oldVersion, 'docs'), { recursive: true });
        copyFileSync(SETUP_SCRIPT, join(oldVersion, 'scripts', 'setup-gemini-md.sh'));
        writeFileSync(join(oldVersion, 'docs', 'GEMINI.md'), `<!-- OMG:START -->\n<!-- OMG:VERSION:4.8.2 -->\n\n# Old Version\n<!-- OMG:END -->\n`);
        mkdirSync(join(newVersion, 'docs'), { recursive: true });
        writeFileSync(join(newVersion, 'docs', 'GEMINI.md'), `<!-- OMG:START -->\n<!-- OMG:VERSION:4.9.0 -->\n\n# New Version\n<!-- OMG:END -->\n`);
        mkdirSync(join(homeRoot, '.gemini', 'plugins'), { recursive: true });
        writeFileSync(join(homeRoot, '.gemini', 'plugins', 'installed_plugins.json'), JSON.stringify({
            plugins: {
                'oh-my-gemini@omg': [
                    {
                        installPath: newVersion,
                        version: '4.9.0',
                    },
                ],
            },
        }));
        mkdirSync(projectRoot, { recursive: true });
        mkdirSync(join(homeRoot, '.gemini'), { recursive: true });
        writeFileSync(join(homeRoot, '.gemini', 'settings.json'), JSON.stringify({ plugins: ['oh-my-gemini'] }));
        const result = spawnSync('bash', [join(oldVersion, 'scripts', 'setup-gemini-md.sh'), 'local'], {
            cwd: projectRoot,
            env: {
                ...process.env,
                HOME: homeRoot,
                GEMINI_CONFIG_DIR: join(homeRoot, '.gemini'),
            },
            encoding: 'utf-8',
        });
        expect(result.status).toBe(0);
        const installed = readFileSync(join(projectRoot, '.gemini', 'GEMINI.md'), 'utf-8');
        expect(installed).toContain('<!-- OMG:VERSION:4.9.0 -->');
        expect(installed).toContain('# New Version');
        expect(installed).not.toContain('<!-- OMG:VERSION:4.8.2 -->');
    });
    it('falls back to scanning cache for latest version when installed_plugins.json is unavailable', () => {
        const root = mkdtempSync(join(tmpdir(), 'omg-stale-fallback-'));
        tempRoots.push(root);
        const cacheBase = join(root, '.gemini', 'plugins', 'cache', 'omg', 'oh-my-gemini');
        const oldVersion = join(cacheBase, '4.8.2');
        const newVersion = join(cacheBase, '4.9.0');
        const projectRoot = join(root, 'project');
        const homeRoot = join(root, 'home');
        // Create old version (where the script lives)
        mkdirSync(join(oldVersion, 'scripts'), { recursive: true });
        mkdirSync(join(oldVersion, 'docs'), { recursive: true });
        copyFileSync(SETUP_SCRIPT, join(oldVersion, 'scripts', 'setup-gemini-md.sh'));
        writeFileSync(join(oldVersion, 'docs', 'GEMINI.md'), `<!-- OMG:START -->\n<!-- OMG:VERSION:4.8.2 -->\n\n# Old\n<!-- OMG:END -->\n`);
        // Create new version (no installed_plugins.json, relies on cache scan)
        mkdirSync(join(newVersion, 'docs'), { recursive: true });
        writeFileSync(join(newVersion, 'docs', 'GEMINI.md'), `<!-- OMG:START -->\n<!-- OMG:VERSION:4.9.0 -->\n\n# New\n<!-- OMG:END -->\n`);
        // No installed_plugins.json — fallback to cache scan
        mkdirSync(join(homeRoot, '.gemini'), { recursive: true });
        mkdirSync(projectRoot, { recursive: true });
        writeFileSync(join(homeRoot, '.gemini', 'settings.json'), JSON.stringify({ plugins: ['oh-my-gemini'] }));
        const result = spawnSync('bash', [join(oldVersion, 'scripts', 'setup-gemini-md.sh'), 'local'], {
            cwd: projectRoot,
            env: {
                ...process.env,
                HOME: homeRoot,
                GEMINI_CONFIG_DIR: join(homeRoot, '.gemini'),
            },
            encoding: 'utf-8',
        });
        expect(result.status).toBe(0);
        const installed = readFileSync(join(projectRoot, '.gemini', 'GEMINI.md'), 'utf-8');
        expect(installed).toContain('<!-- OMG:VERSION:4.9.0 -->');
        expect(installed).not.toContain('<!-- OMG:VERSION:4.8.2 -->');
    });
});
//# sourceMappingURL=setup-gemini-md-script.test.js.map