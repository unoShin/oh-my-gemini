import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { getConfigDir } from '../utils/config-dir.js';
import { getGlobalOmgConfigPath, getGlobalOmgConfigCandidates, getGlobalOmgStatePath, getGlobalOmgStateCandidates, } from '../utils/paths.js';
const MANAGED_START = '# BEGIN OMG MANAGED MCP REGISTRY';
const MANAGED_END = '# END OMG MANAGED MCP REGISTRY';
export function getUnifiedMcpRegistryPath() {
    return process.env.OMG_MCP_REGISTRY_PATH?.trim() || getGlobalOmgConfigPath('mcp-registry.json');
}
function getUnifiedMcpRegistryStatePath() {
    return getGlobalOmgStatePath('mcp-registry-state.json');
}
function getUnifiedMcpRegistryPathCandidates() {
    if (process.env.OMG_MCP_REGISTRY_PATH?.trim()) {
        return [process.env.OMG_MCP_REGISTRY_PATH.trim()];
    }
    return getGlobalOmgConfigCandidates('mcp-registry.json');
}
function getUnifiedMcpRegistryStatePathCandidates() {
    return getGlobalOmgStateCandidates('mcp-registry-state.json');
}
export function getGeminiMcpConfigPath() {
    if (process.env.GEMINI_MCP_CONFIG_PATH?.trim()) {
        return process.env.GEMINI_MCP_CONFIG_PATH.trim();
    }
    return join(dirname(getConfigDir()), '.gemini.json');
}
export function getGeminiConfigPath() {
    const geminiHome = process.env.GEMINI_HOME?.trim() || join(homedir(), '.gemini');
    return join(geminiHome, 'config.toml');
}
function isStringRecord(value) {
    return !!value
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.values(value).every(item => typeof item === 'string');
}
function normalizeRegistryEntry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const raw = value;
    const command = typeof raw.command === 'string' && raw.command.trim().length > 0
        ? raw.command.trim()
        : undefined;
    const url = typeof raw.url === 'string' && raw.url.trim().length > 0
        ? raw.url.trim()
        : undefined;
    if (!command && !url) {
        return null;
    }
    const args = Array.isArray(raw.args) && raw.args.every(item => typeof item === 'string')
        ? [...raw.args]
        : undefined;
    const env = isStringRecord(raw.env) ? { ...raw.env } : undefined;
    const timeout = typeof raw.timeout === 'number' && Number.isFinite(raw.timeout) && raw.timeout > 0
        ? raw.timeout
        : undefined;
    return {
        ...(command ? { command } : {}),
        ...(args && args.length > 0 ? { args } : {}),
        ...(env && Object.keys(env).length > 0 ? { env } : {}),
        ...(url ? { url } : {}),
        ...(timeout ? { timeout } : {}),
    };
}
function normalizeRegistry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const entries = {};
    for (const [name, entry] of Object.entries(value)) {
        const trimmedName = name.trim();
        if (!trimmedName)
            continue;
        const normalized = normalizeRegistryEntry(entry);
        if (normalized) {
            entries[trimmedName] = normalized;
        }
    }
    return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}
export function extractGeminiMcpRegistry(settings) {
    return normalizeRegistry(settings.mcpServers);
}
function loadRegistryFromDisk(path) {
    try {
        return normalizeRegistry(JSON.parse(readFileSync(path, 'utf-8')));
    }
    catch {
        return {};
    }
}
function ensureParentDir(path) {
    const parent = dirname(path);
    if (!existsSync(parent)) {
        mkdirSync(parent, { recursive: true });
    }
}
function readManagedServerNames() {
    for (const statePath of getUnifiedMcpRegistryStatePathCandidates()) {
        if (!existsSync(statePath)) {
            continue;
        }
        try {
            const state = JSON.parse(readFileSync(statePath, 'utf-8'));
            return Array.isArray(state.managedServers)
                ? state.managedServers.filter((item) => typeof item === 'string').sort((a, b) => a.localeCompare(b))
                : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
function writeManagedServerNames(serverNames) {
    const statePath = getUnifiedMcpRegistryStatePath();
    ensureParentDir(statePath);
    writeFileSync(statePath, JSON.stringify({ managedServers: [...serverNames].sort((a, b) => a.localeCompare(b)) }, null, 2));
}
function bootstrapRegistryFromGemini(settings, registryPath) {
    const registry = extractGeminiMcpRegistry(settings);
    if (Object.keys(registry).length === 0) {
        return {};
    }
    ensureParentDir(registryPath);
    writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    return registry;
}
function loadOrBootstrapRegistry(settings) {
    for (const registryPath of getUnifiedMcpRegistryPathCandidates()) {
        if (existsSync(registryPath)) {
            return {
                registry: loadRegistryFromDisk(registryPath),
                registryExists: true,
                bootstrappedFromGemini: false,
            };
        }
    }
    const registryPath = getUnifiedMcpRegistryPath();
    const registry = bootstrapRegistryFromGemini(settings, registryPath);
    return {
        registry,
        registryExists: Object.keys(registry).length > 0,
        bootstrappedFromGemini: Object.keys(registry).length > 0,
    };
}
function entriesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
export function applyRegistryToGeminiSettings(settings) {
    const nextSettings = { ...settings };
    const changed = Object.prototype.hasOwnProperty.call(nextSettings, 'mcpServers');
    delete nextSettings.mcpServers;
    return {
        settings: nextSettings,
        changed,
    };
}
function syncGeminiMcpConfig(existingGeminiConfig, registry, managedServerNames = [], legacySettingsServers = {}) {
    const existingServers = extractGeminiMcpRegistry(existingGeminiConfig);
    const nextServers = { ...legacySettingsServers, ...existingServers };
    for (const managedName of managedServerNames) {
        delete nextServers[managedName];
    }
    for (const [name, entry] of Object.entries(registry)) {
        nextServers[name] = entry;
    }
    const nextGeminiConfig = { ...existingGeminiConfig };
    if (Object.keys(nextServers).length === 0) {
        delete nextGeminiConfig.mcpServers;
    }
    else {
        nextGeminiConfig.mcpServers = nextServers;
    }
    return {
        geminiConfig: nextGeminiConfig,
        changed: !entriesEqual(existingGeminiConfig, nextGeminiConfig),
    };
}
function escapeTomlString(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}
function unescapeTomlString(value) {
    return value
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}
function renderTomlString(value) {
    return `"${escapeTomlString(value)}"`;
}
function parseTomlQuotedString(value) {
    const match = value.trim().match(/^"((?:\\.|[^"\\])*)"$/);
    return match ? unescapeTomlString(match[1]) : undefined;
}
function renderTomlStringArray(values) {
    return `[${values.map(renderTomlString).join(', ')}]`;
}
function parseTomlStringArray(value) {
    try {
        const parsed = JSON.parse(value.trim());
        return Array.isArray(parsed) && parsed.every(item => typeof item === 'string')
            ? parsed
            : undefined;
    }
    catch {
        return undefined;
    }
}
function renderTomlEnvTable(env) {
    const entries = Object.entries(env)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key} = ${renderTomlString(value)}`);
    return `{ ${entries.join(', ')} }`;
}
function parseTomlEnvTable(value) {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return undefined;
    }
    const env = {};
    const inner = trimmed.slice(1, -1);
    const entryPattern = /([A-Za-z0-9_-]+)\s*=\s*"((?:\\.|[^"\\])*)"/g;
    let match;
    while ((match = entryPattern.exec(inner)) !== null) {
        env[match[1]] = unescapeTomlString(match[2]);
    }
    return Object.keys(env).length > 0 ? env : undefined;
}
function renderGeminiServerBlock(name, entry) {
    const lines = [`[mcp_servers.${name}]`];
    if (entry.command) {
        lines.push(`command = ${renderTomlString(entry.command)}`);
    }
    if (entry.args && entry.args.length > 0) {
        lines.push(`args = ${renderTomlStringArray(entry.args)}`);
    }
    if (entry.url) {
        lines.push(`url = ${renderTomlString(entry.url)}`);
    }
    if (entry.env && Object.keys(entry.env).length > 0) {
        lines.push(`env = ${renderTomlEnvTable(entry.env)}`);
    }
    if (entry.timeout) {
        lines.push(`startup_timeout_sec = ${entry.timeout}`);
    }
    return lines.join('\n');
}
function stripManagedGeminiBlock(content) {
    const managedBlockPattern = new RegExp(`${MANAGED_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MANAGED_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g');
    return content.replace(managedBlockPattern, '').trimEnd();
}
export function renderManagedGeminiMcpBlock(registry) {
    const names = Object.keys(registry);
    if (names.length === 0) {
        return '';
    }
    const blocks = names.map(name => renderGeminiServerBlock(name, registry[name]));
    return [MANAGED_START, '', ...blocks.flatMap((block, index) => index === 0 ? [block] : ['', block]), '', MANAGED_END].join('\n');
}
export function syncGeminiConfigToml(existingContent, registry) {
    const base = stripManagedGeminiBlock(existingContent);
    const managedBlock = renderManagedGeminiMcpBlock(registry);
    const nextContent = managedBlock
        ? `${base ? `${base}\n\n` : ''}${managedBlock}\n`
        : (base ? `${base}\n` : '');
    return {
        content: nextContent,
        changed: nextContent !== existingContent,
    };
}
function parseGeminiMcpRegistryEntries(content) {
    const entries = {};
    const lines = content.split(/\r?\n/);
    let currentName = null;
    let currentEntry = {};
    const flushCurrent = () => {
        if (!currentName)
            return;
        const normalized = normalizeRegistryEntry(currentEntry);
        if (normalized) {
            entries[currentName] = normalized;
        }
        currentName = null;
        currentEntry = {};
    };
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const sectionMatch = line.match(/^\[mcp_servers\.([^\]]+)\]$/);
        if (sectionMatch) {
            flushCurrent();
            currentName = sectionMatch[1].trim();
            currentEntry = {};
            continue;
        }
        if (!currentName) {
            continue;
        }
        const [rawKey, ...rawValueParts] = line.split('=');
        if (!rawKey || rawValueParts.length === 0) {
            continue;
        }
        const key = rawKey.trim();
        const value = rawValueParts.join('=').trim();
        if (key === 'command') {
            const parsed = parseTomlQuotedString(value);
            if (parsed)
                currentEntry.command = parsed;
        }
        else if (key === 'args') {
            const parsed = parseTomlStringArray(value);
            if (parsed)
                currentEntry.args = parsed;
        }
        else if (key === 'url') {
            const parsed = parseTomlQuotedString(value);
            if (parsed)
                currentEntry.url = parsed;
        }
        else if (key === 'env') {
            const parsed = parseTomlEnvTable(value);
            if (parsed)
                currentEntry.env = parsed;
        }
        else if (key === 'startup_timeout_sec') {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0)
                currentEntry.timeout = parsed;
        }
    }
    flushCurrent();
    return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}
export function syncUnifiedMcpRegistryTargets(settings) {
    const registryPath = getUnifiedMcpRegistryPath();
    const geminiConfigPath = getGeminiConfigPath();
    const managedServerNames = readManagedServerNames();
    const legacyGeminiRegistry = extractGeminiMcpRegistry(settings);
    const currentGeminiConfig = readJsonObject(geminiConfigPath);
    const geminiConfigForBootstrap = Object.keys(extractGeminiMcpRegistry(currentGeminiConfig)).length > 0
        ? currentGeminiConfig
        : settings;
    const registryState = loadOrBootstrapRegistry(geminiConfigForBootstrap);
    const registry = registryState.registry;
    const serverNames = Object.keys(registry);
    const cleanedSettings = applyRegistryToGeminiSettings(settings);
    const gemini = syncGeminiMcpConfig(currentGeminiConfig, registry, managedServerNames, legacyGeminiRegistry);
    if (gemini.changed) {
        ensureParentDir(geminiConfigPath);
        writeFileSync(geminiConfigPath, JSON.stringify(gemini.geminiConfig, null, 2));
    }
    let geminiChanged = false;
    // Note: Previous logic seemed to overwrite geminiConfigPath with TOML version.
    // Actually, getGeminiConfigPath() returns .gemini/config.toml, while getGeminiMcpConfigPath() returns .gemini.json
    // The original oh-my-geminicode seems to support both.
    // I will stick to getGeminiConfigPath() which is .toml as primarily intended for Gemini.
    if (registryState.registryExists || Object.keys(legacyGeminiRegistry).length > 0 || managedServerNames.length > 0) {
        writeManagedServerNames(serverNames);
    }
    return {
        settings: cleanedSettings.settings,
        result: {
            registryPath,
            geminiConfigPath,
            registryExists: registryState.registryExists,
            bootstrappedFromGemini: registryState.bootstrappedFromGemini,
            serverNames,
            geminiChanged: cleanedSettings.changed || gemini.changed || geminiChanged,
        },
    };
}
function readJsonObject(path) {
    if (!existsSync(path)) {
        return {};
    }
    try {
        const raw = JSON.parse(readFileSync(path, 'utf-8'));
        return raw && typeof raw === 'object' && !Array.isArray(raw)
            ? raw
            : {};
    }
    catch {
        return {};
    }
}
export function inspectUnifiedMcpRegistrySync() {
    const registryPath = getUnifiedMcpRegistryPath();
    const geminiConfigPath = getGeminiConfigPath();
    if (!existsSync(registryPath)) {
        return {
            registryPath,
            geminiConfigPath,
            registryExists: false,
            serverNames: [],
            geminiMissing: [],
            geminiMismatched: [],
        };
    }
    const registry = loadRegistryFromDisk(registryPath);
    const serverNames = Object.keys(registry);
    const geminiEntries = existsSync(geminiConfigPath)
        ? parseGeminiMcpRegistryEntries(readFileSync(geminiConfigPath, 'utf-8'))
        : {};
    const geminiMissing = [];
    const geminiMismatched = [];
    for (const [name, entry] of Object.entries(registry)) {
        if (!geminiEntries[name]) {
            geminiMissing.push(name);
        }
        else if (!entriesEqual(geminiEntries[name], entry)) {
            geminiMismatched.push(name);
        }
    }
    return {
        registryPath,
        geminiConfigPath,
        registryExists: true,
        serverNames,
        geminiMissing,
        geminiMismatched,
    };
}
//# sourceMappingURL=mcp-registry.js.map