import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { applyRegistryToGeminiSettings, getGeminiMcpConfigPath, getUnifiedMcpRegistryPath, getGeminiConfigPath, inspectUnifiedMcpRegistrySync, syncGeminiConfigToml, syncUnifiedMcpRegistryTargets, } from '../mcp-registry.js';
describe('unified MCP registry sync', () => {
    let testRoot;
    let geminiDir;
    let omgDir;
    let originalEnv;
    let originalPlatform;
    beforeEach(() => {
        originalEnv = { ...process.env };
        originalPlatform = process.platform;
        testRoot = mkdtempSync(join(tmpdir(), 'omg-mcp-registry-'));
        geminiDir = join(testRoot, '.gemini');
        omgDir = join(testRoot, '.omg');
        mkdirSync(geminiDir, { recursive: true });
        mkdirSync(omgDir, { recursive: true });
        process.env.GEMINI_CONFIG_DIR = geminiDir;
        process.env.GEMINI_MCP_CONFIG_PATH = join(testRoot, '.gemini.json');
        process.env.GEMINI_HOME = geminiDir;
        process.env.OMG_HOME = omgDir;
    });
    afterEach(() => {
        process.env = originalEnv;
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        if (existsSync(testRoot)) {
            rmSync(testRoot, { recursive: true, force: true });
        }
    });
    it('bootstraps the registry from legacy Gemini settings, migrates to .gemini.json, and syncs Gemini config.toml', () => {
        const settings = {
            theme: 'dark',
            mcpServers: {
                gitnexus: {
                    command: 'gitnexus',
                    args: ['mcp'],
                    timeout: 15,
                },
            },
        };
        const { settings: syncedSettings, result } = syncUnifiedMcpRegistryTargets(settings);
        expect(result.bootstrappedFromGemini).toBe(true);
        expect(result.registryExists).toBe(true);
        expect(result.serverNames).toEqual(['gitnexus']);
        expect(syncedSettings).toEqual({ theme: 'dark' });
        const registryPath = getUnifiedMcpRegistryPath();
        expect(JSON.parse(readFileSync(registryPath, 'utf-8'))).toEqual(settings.mcpServers);
        expect(JSON.parse(readFileSync(getGeminiMcpConfigPath(), 'utf-8'))).toEqual({
            mcpServers: settings.mcpServers,
        });
        const geminiConfig = readFileSync(getGeminiConfigPath(), 'utf-8');
        expect(geminiConfig).toContain('# BEGIN OMG MANAGED MCP REGISTRY');
        expect(geminiConfig).toContain('[mcp_servers.gitnexus]');
        expect(geminiConfig).toContain('command = "gitnexus"');
        expect(geminiConfig).toContain('args = ["mcp"]');
        expect(geminiConfig).toContain('startup_timeout_sec = 15');
    });
    it('round-trips URL-based remote MCP entries through the unified registry sync', () => {
        const settings = {
            mcpServers: {
                remoteOmg: {
                    url: 'https://lab.example.com/mcp',
                    timeout: 30,
                },
            },
        };
        const { settings: syncedSettings, result } = syncUnifiedMcpRegistryTargets(settings);
        expect(result.bootstrappedFromGemini).toBe(true);
        expect(result.serverNames).toEqual(['remoteOmg']);
        expect(syncedSettings).toEqual({});
        const registryPath = getUnifiedMcpRegistryPath();
        expect(JSON.parse(readFileSync(registryPath, 'utf-8'))).toEqual(settings.mcpServers);
        expect(JSON.parse(readFileSync(getGeminiMcpConfigPath(), 'utf-8'))).toEqual({
            mcpServers: settings.mcpServers,
        });
        const geminiConfig = readFileSync(getGeminiConfigPath(), 'utf-8');
        expect(geminiConfig).toContain('[mcp_servers.remoteOmg]');
        expect(geminiConfig).toContain('url = "https://lab.example.com/mcp"');
        expect(geminiConfig).toContain('startup_timeout_sec = 30');
    });
    it('removes legacy mcpServers from settings.json while preserving unrelated Gemini settings', () => {
        const existingSettings = {
            theme: 'dark',
            statusLine: {
                type: 'command',
                command: 'node hud.mjs',
            },
            mcpServers: {
                gitnexus: {
                    command: 'old-gitnexus',
                    args: ['legacy'],
                },
            },
        };
        const { settings, changed } = applyRegistryToGeminiSettings(existingSettings);
        expect(changed).toBe(true);
        expect(settings).toEqual({
            theme: 'dark',
            statusLine: existingSettings.statusLine,
        });
    });
    it('keeps unrelated Gemini TOML and is idempotent across repeated syncs', () => {
        const existingToml = [
            'model = "gpt-5"',
            '',
            '[mcp_servers.custom_local]',
            'command = "custom-local"',
            'args = ["serve"]',
            '',
            '# BEGIN OMG MANAGED MCP REGISTRY',
            '',
            '[mcp_servers.old_registry]',
            'command = "legacy"',
            '',
            '# END OMG MANAGED MCP REGISTRY',
            '',
        ].join('\n');
        const registry = {
            gitnexus: {
                command: 'gitnexus',
                args: ['mcp'],
            },
        };
        const first = syncGeminiConfigToml(existingToml, registry);
        expect(first.changed).toBe(true);
        expect(first.content).toContain('model = "gpt-5"');
        expect(first.content).toContain('[mcp_servers.custom_local]');
        expect(first.content).toContain('[mcp_servers.gitnexus]');
        expect(first.content).not.toContain('[mcp_servers.old_registry]');
        const second = syncGeminiConfigToml(first.content, registry);
        expect(second.changed).toBe(false);
        expect(second.content).toBe(first.content);
    });
    it('removes previously managed Gemini and Gemini MCP entries when the registry becomes empty', () => {
        writeFileSync(join(omgDir, 'mcp-registry-state.json'), JSON.stringify({ managedServers: ['gitnexus'] }, null, 2));
        writeFileSync(getUnifiedMcpRegistryPath(), JSON.stringify({}, null, 2));
        writeFileSync(getGeminiMcpConfigPath(), JSON.stringify({
            mcpServers: {
                gitnexus: { command: 'gitnexus', args: ['mcp'] },
                customLocal: { command: 'custom-local', args: ['serve'] },
            },
        }, null, 2));
        writeFileSync(getGeminiConfigPath(), [
            'model = "gpt-5"',
            '',
            '# BEGIN OMG MANAGED MCP REGISTRY',
            '',
            '[mcp_servers.gitnexus]',
            'command = "gitnexus"',
            'args = ["mcp"]',
            '',
            '# END OMG MANAGED MCP REGISTRY',
            '',
        ].join('\n'));
        const settings = {
            theme: 'dark',
            mcpServers: {
                gitnexus: { command: 'gitnexus', args: ['mcp'] },
            },
        };
        const { settings: syncedSettings, result } = syncUnifiedMcpRegistryTargets(settings);
        expect(result.registryExists).toBe(true);
        expect(result.serverNames).toEqual([]);
        expect(result.geminiChanged).toBe(true);
        expect(syncedSettings).toEqual({ theme: 'dark' });
        expect(JSON.parse(readFileSync(getGeminiMcpConfigPath(), 'utf-8'))).toEqual({
            mcpServers: {
                customLocal: { command: 'custom-local', args: ['serve'] },
            },
        });
        expect(readFileSync(getGeminiConfigPath(), 'utf-8')).toBe('model = "gpt-5"\n');
    });
    it('detects mismatched server definitions during doctor inspection, not just missing names', () => {
        writeFileSync(getUnifiedMcpRegistryPath(), JSON.stringify({
            gitnexus: { command: 'gitnexus', args: ['mcp'], timeout: 15 },
        }, null, 2));
        writeFileSync(getGeminiMcpConfigPath(), JSON.stringify({
            mcpServers: {
                gitnexus: { command: 'gitnexus', args: ['wrong'] },
            },
        }, null, 2));
        mkdirSync(geminiDir, { recursive: true });
        writeFileSync(getGeminiConfigPath(), [
            '# BEGIN OMG MANAGED MCP REGISTRY',
            '',
            '[mcp_servers.gitnexus]',
            'command = "gitnexus"',
            'args = ["wrong"]',
            '',
            '# END OMG MANAGED MCP REGISTRY',
            '',
        ].join('\n'));
        const status = inspectUnifiedMcpRegistrySync();
        expect(status.geminiMissing).toEqual([]);
        expect(status.geminiMismatched).toEqual(['gitnexus']);
    });
    it('is idempotent when registry, Gemini MCP root config, and Gemini TOML already match', () => {
        writeFileSync(getUnifiedMcpRegistryPath(), JSON.stringify({
            remoteOmg: { url: 'https://lab.example.com/mcp', timeout: 30 },
        }, null, 2));
        writeFileSync(getGeminiMcpConfigPath(), JSON.stringify({
            mcpServers: {
                remoteOmg: { url: 'https://lab.example.com/mcp', timeout: 30 },
            },
        }, null, 2));
        writeFileSync(getGeminiConfigPath(), [
            '# BEGIN OMG MANAGED MCP REGISTRY',
            '',
            '[mcp_servers.remoteOmg]',
            'url = "https://lab.example.com/mcp"',
            'startup_timeout_sec = 30',
            '',
            '# END OMG MANAGED MCP REGISTRY',
            '',
        ].join('\n'));
        const { settings, result } = syncUnifiedMcpRegistryTargets({ theme: 'dark' });
        expect(settings).toEqual({ theme: 'dark' });
        expect(result.bootstrappedFromGemini).toBe(false);
        expect(result.geminiChanged).toBe(false);
    });
    it('preserves existing .gemini.json server definitions when legacy settings still contain stale copies', () => {
        writeFileSync(getUnifiedMcpRegistryPath(), JSON.stringify({
            gitnexus: { command: 'gitnexus', args: ['mcp'] },
        }, null, 2));
        writeFileSync(getGeminiMcpConfigPath(), JSON.stringify({
            mcpServers: {
                gitnexus: { command: 'gitnexus', args: ['mcp'] },
                customLocal: { command: 'custom-local', args: ['serve'] },
            },
        }, null, 2));
        const { settings, result } = syncUnifiedMcpRegistryTargets({
            theme: 'dark',
            mcpServers: {
                customLocal: { command: 'stale-custom', args: ['legacy'] },
            },
        });
        expect(settings).toEqual({ theme: 'dark' });
        expect(result.bootstrappedFromGemini).toBe(false);
        expect(JSON.parse(readFileSync(getGeminiMcpConfigPath(), 'utf-8'))).toEqual({
            mcpServers: {
                customLocal: { command: 'custom-local', args: ['serve'] },
                gitnexus: { command: 'gitnexus', args: ['mcp'] },
            },
        });
    });
    it('detects mismatched URL-based remote MCP definitions during doctor inspection', () => {
        writeFileSync(getUnifiedMcpRegistryPath(), JSON.stringify({
            remoteOmg: { url: 'https://lab.example.com/mcp', timeout: 30 },
        }, null, 2));
        writeFileSync(getGeminiMcpConfigPath(), JSON.stringify({
            mcpServers: {
                remoteOmg: { url: 'https://staging.example.com/mcp', timeout: 30 },
            },
        }, null, 2));
        mkdirSync(geminiDir, { recursive: true });
        writeFileSync(getGeminiConfigPath(), [
            '# BEGIN OMG MANAGED MCP REGISTRY',
            '',
            '[mcp_servers.remoteOmg]',
            'url = "https://staging.example.com/mcp"',
            'startup_timeout_sec = 30',
            '',
            '# END OMG MANAGED MCP REGISTRY',
            '',
        ].join('\n'));
        const status = inspectUnifiedMcpRegistrySync();
        expect(status.geminiMissing).toEqual([]);
        expect(status.geminiMismatched).toEqual(['remoteOmg']);
    });
    it('uses XDG config/state defaults when OMG_HOME is unset on Linux', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        delete process.env.OMG_HOME;
        process.env.HOME = testRoot;
        process.env.XDG_CONFIG_HOME = join(testRoot, '.config');
        process.env.XDG_STATE_HOME = join(testRoot, '.state');
        const { result } = syncUnifiedMcpRegistryTargets({
            mcpServers: {
                gitnexus: {
                    command: 'gitnexus',
                    args: ['mcp'],
                },
            },
        });
        expect(result.registryPath).toBe(join(testRoot, '.config', 'omg', 'mcp-registry.json'));
        expect(existsSync(join(testRoot, '.config', 'omg', 'mcp-registry.json'))).toBe(true);
        expect(existsSync(join(testRoot, '.state', 'omg', 'mcp-registry-state.json'))).toBe(true);
    });
    it('falls back to legacy ~/.omg registry when the XDG registry does not exist', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        delete process.env.OMG_HOME;
        process.env.HOME = testRoot;
        process.env.XDG_CONFIG_HOME = join(testRoot, '.config');
        process.env.XDG_STATE_HOME = join(testRoot, '.state');
        const legacyRegistryDir = join(testRoot, '.omg');
        mkdirSync(legacyRegistryDir, { recursive: true });
        writeFileSync(join(legacyRegistryDir, 'mcp-registry.json'), JSON.stringify({
            gitnexus: { command: 'gitnexus', args: ['mcp'] },
        }, null, 2));
        const { result } = syncUnifiedMcpRegistryTargets({ theme: 'dark' });
        expect(result.registryExists).toBe(true);
        expect(result.serverNames).toEqual(['gitnexus']);
        expect(result.bootstrappedFromGemini).toBe(false);
    });
});
//# sourceMappingURL=mcp-registry.test.js.map