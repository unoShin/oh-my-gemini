/**
 * Installer Module
 *
 * Handles installation of OMG agents, commands, and configuration
 * into the Gemini Code config directory (~/.gemini/).
 *
 * Cross-platform support via Node.js-based hook scripts (.mjs).
 * Bash hook scripts were removed in v3.9.0.
 */

/** Current version */
export const VERSION = '0.1.0';

import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';
import {
  isWindows,
  MIN_NODE_VERSION
} from './hooks.js';

import { getConfigDir } from '../utils/config-dir.js';
import { resolveNodeBinary } from '../utils/resolve-node.js';
import { syncUnifiedMcpRegistryTargets } from './mcp-registry.js';



/** Gemini Code configuration directory */
export const GEMINI_CONFIG_DIR = getConfigDir();
export const AGENTS_DIR = join(GEMINI_CONFIG_DIR, 'agents');
export const COMMANDS_DIR = join(GEMINI_CONFIG_DIR, 'commands');
export const SKILLS_DIR = join(GEMINI_CONFIG_DIR, 'skills');
export const HOOKS_DIR = join(GEMINI_CONFIG_DIR, 'hooks');
export const HUD_DIR = join(GEMINI_CONFIG_DIR, 'hud');
export const SETTINGS_FILE = join(GEMINI_CONFIG_DIR, 'settings.json');
export const VERSION_FILE = join(GEMINI_CONFIG_DIR, '.omg-version.json');

/**
 * Core commands - DISABLED for v3.0+
 * All commands are now plugin-scoped skills managed by Gemini Code.
 * The installer no longer copies commands to ~/.gemini/commands/
 */
export const CORE_COMMANDS: string[] = [];

const OMG_VERSION_MARKER_PATTERN = /<!-- OMG:VERSION:([^\s]+) -->/;

/**
 * Detects the newest installed OMG version from persistent metadata or
 * existing GEMINI.md markers so an older CLI package cannot overwrite a
 * newer installation during `omg setup`.
 */
function isComparableVersion(version: string | null | undefined): version is string {
  return !!version && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version);
}

function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(part => parseInt(part, 10) || 0);
  const partsB = b.replace(/^v/, '').split('.').map(part => parseInt(part, 10) || 0);
  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i++) {
    const valueA = partsA[i] || 0;
    const valueB = partsB[i] || 0;
    if (valueA < valueB) return -1;
    if (valueA > valueB) return 1;
  }

  return 0;
}

function extractOmgVersionMarker(content: string): string | null {
  const match = content.match(OMG_VERSION_MARKER_PATTERN);
  return match?.[1] ?? null;
}

function getNewestInstalledVersionHint(): string | null {
  const candidates: string[] = [];

  if (existsSync(VERSION_FILE)) {
    try {
      const metadata = JSON.parse(readFileSync(VERSION_FILE, 'utf-8')) as { version?: string };
      if (isComparableVersion(metadata.version)) {
        candidates.push(metadata.version);
      }
    } catch {
      // Ignore unreadable metadata and fall back to GEMINI.md markers.
    }
  }

  const geminiCandidates = [
    join(GEMINI_CONFIG_DIR, 'GEMINI.md'),
    join(homedir(), 'GEMINI.md'),
  ];

  for (const candidatePath of geminiCandidates) {
    if (!existsSync(candidatePath)) continue;
    try {
      const detectedVersion = extractOmgVersionMarker(readFileSync(candidatePath, 'utf-8'));
      if (isComparableVersion(detectedVersion)) {
        candidates.push(detectedVersion);
      }
    } catch {
      // Ignore unreadable GEMINI.md candidates.
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((highest, candidate) =>
    compareVersions(candidate, highest) > 0 ? candidate : highest
  );
}

/**
 * Find a marker that appears at the start of a line (line-anchored).
 * This prevents matching markers inside code blocks.
 * @param content - The content to search in
 * @param marker - The marker string to find
 * @param fromEnd - If true, finds the LAST occurrence instead of first
 * @returns The index of the marker, or -1 if not found
 */
function findLineAnchoredMarker(content: string, marker: string, fromEnd: boolean = false): number {
  // Escape special regex characters in marker
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedMarker}$`, 'gm');

  if (fromEnd) {
    // Find the last occurrence
    let lastIndex = -1;
    let match;
    while ((match = regex.exec(content)) !== null) {
      lastIndex = match.index;
    }
    return lastIndex;
  } else {
    // Find the first occurrence
    const match = regex.exec(content);
    return match ? match.index : -1;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLineAnchoredMarkerRegex(marker: string, flags: string = 'gm'): RegExp {
  return new RegExp(`^${escapeRegex(marker)}$`, flags);
}

function stripGeneratedUserCustomizationHeaders(content: string): string {
  return content.replace(
    /^<!-- User customizations(?: \([^)]+\))? -->\r?\n?/gm,
    ''
  );
}

function trimGeminiUserContent(content: string): string {
  if (content.trim().length === 0) {
    return '';
  }

  return content
    .replace(/^(?:[ \t]*\r?\n)+/, '')
    .replace(/(?:\r?\n[ \t]*)+$/, '')
    .replace(/(?:\r?\n){3,}/g, '\n\n');
}

/** Installation result */
export interface InstallResult {
  success: boolean;
  message: string;
  installedAgents: string[];
  installedCommands: string[];
  installedSkills: string[];
  hooksConfigured: boolean;
  hookConflicts: Array<{ eventType: string; existingCommand: string }>;
  errors: string[];
}

/** Installation options */
export interface InstallOptions {
  force?: boolean;
  version?: string;
  verbose?: boolean;
  skipGeminiCheck?: boolean;
  forceHooks?: boolean;
  refreshHooksInPlugin?: boolean;
  skipHud?: boolean;
}

/**
 * Read hudEnabled from .omg-config.json without importing auto-update
 * (avoids circular dependency since auto-update imports from installer)
 */
export function isHudEnabledInConfig(): boolean {
  const configPath = join(GEMINI_CONFIG_DIR, '.omg-config.json');
  if (!existsSync(configPath)) {
    return true; // default: enabled
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    // Only disable if explicitly set to false
    return config.hudEnabled !== false;
  } catch {
    return true; // default: enabled on parse error
  }
}

/**
 * Detect whether a statusLine config belongs to oh-my-gemini.
 *
 * Checks the command string for known OMG HUD paths so that custom
 * (non-OMG) statusLine configurations are preserved during forced
 * updates/reconciliation.
 *
 * @param statusLine - The statusLine setting object from settings.json
 * @returns true if the statusLine was set by OMG
 */
export function isOmgStatusLine(statusLine: unknown): boolean {
  if (!statusLine) return false;
  // Legacy string format (pre-v4.5): "~/.gemini/hud/omg-hud.mjs"
  if (typeof statusLine === 'string') {
    return statusLine.includes('omg-hud');
  }
  // Current object format: { type: "command", command: "node ...omg-hud.mjs" }
  if (typeof statusLine === 'object') {
    const sl = statusLine as Record<string, unknown>;
    if (typeof sl.command === 'string') {
      return sl.command.includes('omg-hud');
    }
  }
  return false;
}

/**
 * Known OMG hook script filenames installed into .gemini/hooks/.
 * Must be kept in sync with HOOKS_SETTINGS_CONFIG_NODE command entries.
 */
const OMG_HOOK_FILENAMES = new Set([
  'keyword-detector.mjs',
  'session-start.mjs',
  'pre-tool-use.mjs',
  'post-tool-use.mjs',
  'post-tool-use-failure.mjs',
  'persistent-mode.mjs',
  'stop-continuation.mjs',
]);

/**
 * Detect whether a hook command belongs to oh-my-gemini.
 *
 * Recognition strategy (any match is sufficient):
 * 1. Command path contains "omg" as a path/word segment (e.g. `omg-hook.mjs`, `/omg/`)
 * 2. Command path contains "oh-my-gemini"
 * 3. Command references a known OMG hook filename inside .gemini/hooks/
 *
 * @param command - The hook command string
 * @returns true if the command belongs to OMG
 */
export function isOmgHook(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  // Match "omg" as a path segment or word boundary
  // Matches: /omg/, /omg-, omg/, -omg, _omg, omg_
  const omgPattern = /(?:^|[\/\\_-])omg(?:$|[\/\\_-])/;
  const fullNamePattern = /oh-my-gemini/;
  if (omgPattern.test(lowerCommand) || fullNamePattern.test(lowerCommand)) {
    return true;
  }
  // Check for known OMG hook filenames in .gemini/hooks/ path.
  // Handles both Unix (.gemini/hooks/) and Windows (.gemini\hooks\) paths.
  const hookPathMatch = lowerCommand.match(/\.gemini[/\\]hooks[/\\]([a-z0-9-]+\.mjs)/);
  if (hookPathMatch && OMG_HOOK_FILENAMES.has(hookPathMatch[1])) {
    return true;
  }
  return false;
}

/**
 * Check if the current Node.js version meets the minimum requirement
 */
export function checkNodeVersion(): { valid: boolean; current: number; required: number } {
  const current = parseInt(process.versions.node.split('.')[0], 10);
  return {
    valid: current >= MIN_NODE_VERSION,
    current,
    required: MIN_NODE_VERSION
  };
}

/**
 * Check if Gemini Code is installed
 * Uses 'where' on Windows, 'which' on Unix
 */
export function isGeminiInstalled(): boolean {
  try {
    const command = isWindows() ? 'where gemini' : 'which gemini';
    execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if we're running in Gemini Code plugin context
 *
 * When installed as a plugin, we should NOT copy files to ~/.gemini/
 * because the plugin system already handles file access via ${GEMINI_PLUGIN_ROOT}.
 *
 * Detection method:
 * - Check if GEMINI_PLUGIN_ROOT environment variable is set (primary method)
 * - This env var is set by the Gemini Code plugin system when running plugin hooks
 *
 * @returns true if running in plugin context, false otherwise
 */
export function isRunningAsPlugin(): boolean {
  // Check for GEMINI_PLUGIN_ROOT env var (set by plugin system)
  // This is the most reliable indicator that we're running as a plugin
  return !!process.env.GEMINI_PLUGIN_ROOT;
}

/**
 * Check if we're running as a project-scoped plugin (not global)
 *
 * Project-scoped plugins are installed in the project's .gemini/plugins/ directory,
 * while global plugins are installed in ~/.gemini/plugins/.
 *
 * When project-scoped, we should NOT modify global settings (like ~/.gemini/settings.json)
 * because the user explicitly chose project-level installation.
 *
 * @returns true if running as a project-scoped plugin, false otherwise
 */
export function isProjectScopedPlugin(): boolean {
  const pluginRoot = process.env.GEMINI_PLUGIN_ROOT;
  if (!pluginRoot) {
    return false;
  }

  // Global plugins are installed under ~/.gemini/plugins/
  const globalPluginBase = join(GEMINI_CONFIG_DIR, 'plugins');

  // If the plugin root is NOT under the global plugin directory, it's project-scoped
  // Normalize paths for comparison (resolve symlinks, trailing slashes, etc.)
  const normalizedPluginRoot = pluginRoot.replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedGlobalBase = globalPluginBase.replace(/\\/g, '/').replace(/\/$/, '');

  return !normalizedPluginRoot.startsWith(normalizedGlobalBase);
}

function directoryHasMarkdownFiles(directory: string): boolean {
  if (!existsSync(directory)) {
    return false;
  }

  try {
    return readdirSync(directory).some(file => file.endsWith('.md'));
  } catch {
    return false;
  }
}

export function getInstalledOmgPluginRoots(): string[] {
  const pluginRoots = new Set<string>();
  const pluginRoot = process.env.GEMINI_PLUGIN_ROOT?.trim();

  if (pluginRoot) {
    pluginRoots.add(pluginRoot);
  }

  const installedPluginsPath = join(GEMINI_CONFIG_DIR, 'plugins', 'installed_plugins.json');
  if (!existsSync(installedPluginsPath)) {
    return Array.from(pluginRoots);
  }

  try {
    const raw = JSON.parse(readFileSync(installedPluginsPath, 'utf-8')) as {
      plugins?: Record<string, Array<{ installPath?: string }>>;
    } | Record<string, Array<{ installPath?: string }>>;
    const plugins = raw.plugins ?? raw;

    for (const [pluginId, entries] of Object.entries(plugins)) {
      if (!pluginId.toLowerCase().includes('oh-my-gemini') || !Array.isArray(entries)) {
        continue;
      }

      for (const entry of entries) {
        if (typeof entry?.installPath === 'string' && entry.installPath.trim().length > 0) {
          pluginRoots.add(entry.installPath.trim());
        }
      }
    }
  } catch {
    // Ignore unreadable plugin registry and fall back to env-based detection.
  }

  return Array.from(pluginRoots);
}

/**
 * Detect whether an installed Gemini Code plugin already provides OMG agent
 * markdown files, so the legacy ~/.gemini/agents copy can be skipped.
 */
export function hasPluginProvidedAgentFiles(): boolean {
  return getInstalledOmgPluginRoots().some(pluginRoot =>
    directoryHasMarkdownFiles(join(pluginRoot, 'agents'))
  );
}

/**
 * Get the package root directory.
 * Works for both ESM (dist/installer/) and CJS bundles (bridge/).
 * When esbuild bundles to CJS, import.meta is replaced with {} so we
 * fall back to __dirname which is natively available in CJS.
 */
function getPackageDir(): string {
  // CJS bundle path (bridge/cli.cjs): from bridge/ go up 1 level to package root
  if (typeof __dirname !== 'undefined') {
    return join(__dirname, '..');
  }
  // ESM path (works in dev via ts/dist)
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // From dist/installer/index.js, go up to package root
    return join(__dirname, '..', '..');
  } catch {
    // import.meta.url unavailable — last resort
    return process.cwd();
  }
}

export function getRuntimePackageRoot(): string {
  return getPackageDir();
}

/**
 * Load agent definitions from /agents/*.md files
 */
function loadAgentDefinitions(): Record<string, string> {
  const agentsDir = join(getPackageDir(), 'agents');
  const definitions: Record<string, string> = {};

  if (!existsSync(agentsDir)) {
    console.error(`FATAL: agents directory not found: ${agentsDir}`);
    process.exit(1);
  }

  for (const file of readdirSync(agentsDir)) {
    if (file.endsWith('.md')) {
      definitions[file] = readFileSync(join(agentsDir, file), 'utf-8');
    }
  }

  return definitions;
}

/**
 * Load command definitions from /commands/*.md files
 *
 * NOTE: The commands/ directory was removed in v4.1.16 (#582).
 * All commands are now plugin-scoped skills. This function returns
 * an empty object for backward compatibility.
 */
function loadCommandDefinitions(): Record<string, string> {
  const commandsDir = join(getPackageDir(), 'commands');

  if (!existsSync(commandsDir)) {
    return {};
  }

  const definitions: Record<string, string> = {};
  for (const file of readdirSync(commandsDir)) {
    if (file.endsWith('.md')) {
      definitions[file] = readFileSync(join(commandsDir, file), 'utf-8');
    }
  }

  return definitions;
}

/**
 * Load GEMINI.md content from /docs/GEMINI.md
 */
function loadBundledSkillContent(skillName: string): string | null {
  const skillPath = join(getPackageDir(), 'skills', skillName, 'SKILL.md');

  if (!existsSync(skillPath)) {
    return null;
  }

  return readFileSync(skillPath, 'utf-8');
}

function loadGeminiMdContent(): string {
  const geminiMdPath = join(getPackageDir(), 'docs', 'GEMINI.md');

  if (!existsSync(geminiMdPath)) {
    console.error(`FATAL: GEMINI.md not found: ${geminiMdPath}`);
    process.exit(1);
  }

  return readFileSync(geminiMdPath, 'utf-8');
}

/**
 * Extract the embedded OMG version from a GEMINI.md file.
 *
 * Primary source of truth is the injected `<!-- OMG:VERSION:x.y.z -->` marker.
 * Falls back to legacy headings that may include a version string inline.
 */
export function extractOmgVersionFromGeminiMd(content: string): string | null {
  const versionMarkerMatch = content.match(/<!--\s*OMG:VERSION:([^\s]+)\s*-->/i);
  if (versionMarkerMatch?.[1]) {
    const markerVersion = versionMarkerMatch[1].trim();
    return markerVersion.startsWith('v') ? markerVersion : `v${markerVersion}`;
  }

  const headingMatch = content.match(/^#\s+oh-my-gemini.*?\b(v?\d+\.\d+\.\d+(?:[-+][^\s]+)?)\b/m);
  if (headingMatch?.[1]) {
    const headingVersion = headingMatch[1].trim();
    return headingVersion.startsWith('v') ? headingVersion : `v${headingVersion}`;
  }

  return null;
}

/**
 * Keep persisted setup metadata in sync with the installed OMG runtime version.
 *
 * This intentionally updates only already-configured users by default so
 * installer/reconciliation flows do not accidentally mark fresh installs as if
 * the interactive setup wizard had been completed.
 */
export function syncPersistedSetupVersion(options?: {
  configPath?: string;
  geminiMdPath?: string;
  version?: string;
  onlyIfConfigured?: boolean;
}): boolean {
  const configPath = options?.configPath ?? join(GEMINI_CONFIG_DIR, '.omg-config.json');
  let config: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    const rawConfig = readFileSync(configPath, 'utf-8').trim();
    if (rawConfig.length > 0) {
      config = JSON.parse(rawConfig) as Record<string, unknown>;
    }
  }

  const onlyIfConfigured = options?.onlyIfConfigured ?? true;
  const isConfigured = typeof config.setupCompleted === 'string' || typeof config.setupVersion === 'string';
  if (onlyIfConfigured && !isConfigured) {
    return false;
  }

  let detectedVersion = options?.version?.trim();
  if (!detectedVersion) {
    const geminiMdPath = options?.geminiMdPath ?? join(GEMINI_CONFIG_DIR, 'GEMINI.md');
    if (existsSync(geminiMdPath)) {
      detectedVersion = extractOmgVersionFromGeminiMd(readFileSync(geminiMdPath, 'utf-8')) ?? undefined;
    }
  }

  const normalizedVersion = (() => {
    const candidate = (detectedVersion && detectedVersion !== 'unknown') ? detectedVersion : VERSION;
    return candidate.startsWith('v') ? candidate : `v${candidate}`;
  })();

  if (config.setupVersion === normalizedVersion) {
    return false;
  }

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ ...config, setupVersion: normalizedVersion }, null, 2));
  return true;
}

/**
 * Merge OMG content into existing GEMINI.md using markers
 * @param existingContent - Existing GEMINI.md content (null if file doesn't exist)
 * @param omgContent - New OMG content to inject
 * @returns Merged content with markers
 */
export function mergeGeminiMd(existingContent: string | null, omgContent: string, version?: string): string {
  const START_MARKER = '<!-- OMG:START -->';
  const END_MARKER = '<!-- OMG:END -->';
  const USER_CUSTOMIZATIONS = '<!-- User customizations -->';
  const OMG_BLOCK_PATTERN = new RegExp(
    `^${escapeRegex(START_MARKER)}\\r?\\n[\\s\\S]*?^${escapeRegex(END_MARKER)}(?:\\r?\\n)?`,
    'gm'
  );
  const markerStartRegex = createLineAnchoredMarkerRegex(START_MARKER);
  const markerEndRegex = createLineAnchoredMarkerRegex(END_MARKER);

  // Idempotency guard: strip markers from omgContent if already present
  // This handles the case where docs/GEMINI.md ships with markers
  let cleanOmgContent = omgContent;
  const omgStartIdx = findLineAnchoredMarker(omgContent, START_MARKER);
  const omgEndIdx = findLineAnchoredMarker(omgContent, END_MARKER, true);
  if (omgStartIdx !== -1 && omgEndIdx !== -1 && omgStartIdx < omgEndIdx) {
    // Extract content between markers, trimming any surrounding whitespace
    cleanOmgContent = omgContent
      .substring(omgStartIdx + START_MARKER.length, omgEndIdx)
      .trim();
  }

  // Strip any existing version marker from content and inject current version
  cleanOmgContent = cleanOmgContent.replace(/<!-- OMG:VERSION:[^\s]*? -->\n?/, '');
  const versionMarker = version ? `<!-- OMG:VERSION:${version} -->\n` : '';

  // Case 1: No existing content - wrap omgContent in markers
  if (!existingContent) {
    return `${START_MARKER}\n${versionMarker}${cleanOmgContent}\n${END_MARKER}\n`;
  }

  const strippedExistingContent = existingContent.replace(OMG_BLOCK_PATTERN, '');
  const hasResidualStartMarker = markerStartRegex.test(strippedExistingContent);
  const hasResidualEndMarker = markerEndRegex.test(strippedExistingContent);

  // Case 2: Corrupted markers (unmatched markers remain after removing complete blocks)
  if (hasResidualStartMarker || hasResidualEndMarker) {
    // Handle corrupted state - backup will be created by caller
    // Strip unmatched OMG markers from recovered content to prevent unbounded
    // growth on repeated calls (each call would re-detect corruption and append again)
    const recoveredContent = strippedExistingContent
      .replace(markerStartRegex, '')
      .replace(markerEndRegex, '')
      .trim();
    return `${START_MARKER}\n${versionMarker}${cleanOmgContent}\n${END_MARKER}\n\n<!-- User customizations (recovered from corrupted markers) -->\n${recoveredContent}`;
  }

  const preservedUserContent = trimGeminiUserContent(
    stripGeneratedUserCustomizationHeaders(strippedExistingContent)
  );

  if (!preservedUserContent) {
    return `${START_MARKER}\n${versionMarker}${cleanOmgContent}\n${END_MARKER}\n`;
  }

  // Case 3: Preserve only user-authored content that lives outside OMG markers
  return `${START_MARKER}\n${versionMarker}${cleanOmgContent}\n${END_MARKER}\n\n${USER_CUSTOMIZATIONS}\n${preservedUserContent}`;
}

/**
 * Install OMG agents, commands, skills, and hooks
 */
export function install(options: InstallOptions = {}): InstallResult {
  const result: InstallResult = {
    success: false,
    message: '',
    installedAgents: [],
    installedCommands: [],
    installedSkills: [],
    hooksConfigured: false,
    hookConflicts: [],
    errors: []
  };

  const log = (msg: string) => {
    if (options.verbose) {
      console.log(msg);
    }
  };

  // Check Node.js version (required for Node.js hooks)
  const nodeCheck = checkNodeVersion();
  if (!nodeCheck.valid) {
    result.errors.push(`Node.js ${nodeCheck.required}+ is required. Found: ${nodeCheck.current}`);
    result.message = `Installation failed: Node.js ${nodeCheck.required}+ required`;
    return result;
  }

  const targetVersion = options.version ?? VERSION;
  const installedVersionHint = getNewestInstalledVersionHint();

  if (isComparableVersion(targetVersion)
    && isComparableVersion(installedVersionHint)
    && compareVersions(targetVersion, installedVersionHint) < 0) {
    const message = `Skipping install: installed OMG ${installedVersionHint} is newer than CLI package ${targetVersion}. Run "omg update" to update the CLI package, then rerun "omg setup".`;
    log(message);
    result.success = true;
    result.message = message;
    return result;
  }

  // Log platform info
  log(`Platform: ${process.platform} (Node.js hooks)`);

  // Check if running as a plugin
  const runningAsPlugin = isRunningAsPlugin();
  const projectScoped = isProjectScopedPlugin();
  const pluginProvidesAgentFiles = hasPluginProvidedAgentFiles();
  const shouldInstallLegacyAgents = !runningAsPlugin && !pluginProvidesAgentFiles;
  const allowPluginHookRefresh = runningAsPlugin && options.refreshHooksInPlugin && !projectScoped;
  if (runningAsPlugin) {
    log('Detected Gemini Code plugin context - skipping agent/command file installation');
    log('Plugin files are managed by Gemini Code plugin system');
    if (projectScoped) {
      log('Detected project-scoped plugin - skipping global HUD/settings modifications');
    } else {
      log('Will still install HUD statusline...');
      if (allowPluginHookRefresh) {
        log('Will refresh global hooks/settings for plugin runtime reconciliation');
      }
    }
    // Don't return early - continue to install HUD (unless project-scoped)
  } else if (pluginProvidesAgentFiles) {
    log('Detected installed OMG plugin agent definitions - skipping legacy ~/.gemini/agents sync');
  }

  // Check Gemini installation (optional)
  if (!options.skipGeminiCheck && !isGeminiInstalled()) {
    log('Warning: Gemini Code not found. Install it first:');
    if (isWindows()) {
      log('  Visit https://docs.anthropic.com/gemini-cli for Windows installation');
    } else {
      log('  curl -fsSL https://gemini.ai/install.sh | bash');
    }
    // Continue anyway - user might be installing ahead of time
  }

  try {
    // Ensure base config directory exists (skip for project-scoped plugins)
    if (!projectScoped && !existsSync(GEMINI_CONFIG_DIR)) {
      mkdirSync(GEMINI_CONFIG_DIR, { recursive: true });
    }

    // Skip agent/command/hook file installation when running as plugin
    // Plugin system handles these via ${GEMINI_PLUGIN_ROOT}
    if (!runningAsPlugin) {
      // Create directories
      log('Creating directories...');
      if (shouldInstallLegacyAgents && !existsSync(AGENTS_DIR)) {
        mkdirSync(AGENTS_DIR, { recursive: true });
      }
      // NOTE: COMMANDS_DIR creation removed - commands/ deprecated in v4.1.16 (#582)
      if (!existsSync(SKILLS_DIR)) {
        mkdirSync(SKILLS_DIR, { recursive: true });
      }
      if (!existsSync(HOOKS_DIR)) {
        mkdirSync(HOOKS_DIR, { recursive: true });
      }

      // Install agents
      if (shouldInstallLegacyAgents) {
        log('Installing agent definitions...');
        for (const [filename, content] of Object.entries(loadAgentDefinitions())) {
          const filepath = join(AGENTS_DIR, filename);
          if (existsSync(filepath) && !options.force) {
            log(`  Skipping ${filename} (already exists)`);
          } else {
            writeFileSync(filepath, content);
            result.installedAgents.push(filename);
            log(`  Installed ${filename}`);
          }
        }
      } else {
        log('Skipping legacy agent file installation (plugin-provided agents are available)');
      }

      // Skip command installation - all commands are now plugin-scoped skills
      // Commands are accessible via the plugin system (${GEMINI_PLUGIN_ROOT}/commands/)
      // and are managed by Gemini Code's skill discovery mechanism.
      log('Skipping slash command installation (all commands are now plugin-scoped skills)');

      // The command installation loop is disabled - CORE_COMMANDS is empty
      for (const [filename, content] of Object.entries(loadCommandDefinitions())) {
        // All commands are skipped - they're managed by the plugin system
        if (!CORE_COMMANDS.includes(filename)) {
          log(`  Skipping ${filename} (plugin-scoped skill)`);
          continue;
        }

        const filepath = join(COMMANDS_DIR, filename);

        // Create command directory if needed (only for nested paths like 'ultrawork/skill.md')
        // Handle both Unix (/) and Windows (\) path separators
        if (filename.includes('/') || filename.includes('\\')) {
          const segments = filename.split(/[/\\]/);
          const commandDir = join(COMMANDS_DIR, segments[0]);
          if (!existsSync(commandDir)) {
            mkdirSync(commandDir, { recursive: true });
          }
        }

        if (existsSync(filepath) && !options.force) {
          log(`  Skipping ${filename} (already exists)`);
        } else {
          writeFileSync(filepath, content);
          result.installedCommands.push(filename);
          log(`  Installed ${filename}`);
        }
      }

      // NOTE: SKILL_DEFINITIONS removed - skills now only installed via COMMAND_DEFINITIONS
      // to avoid duplicate entries in Gemini Code's available skills list

      const omgReferenceSkillContent = loadBundledSkillContent('omg-reference');
      if (omgReferenceSkillContent) {
        const omgReferenceDir = join(SKILLS_DIR, 'omg-reference');
        const omgReferencePath = join(omgReferenceDir, 'SKILL.md');
        if (!existsSync(omgReferenceDir)) {
          mkdirSync(omgReferenceDir, { recursive: true });
        }
        if (existsSync(omgReferencePath) && !options.force) {
          log('  Skipping omg-reference/SKILL.md (already exists)');
        } else {
          writeFileSync(omgReferencePath, omgReferenceSkillContent);
          result.installedSkills.push('omg-reference/SKILL.md');
          log('  Installed omg-reference/SKILL.md');
        }
      }

      // Install GEMINI.md with merge support
      const geminiMdPath = join(GEMINI_CONFIG_DIR, 'GEMINI.md');
      const homeMdPath = join(homedir(), 'GEMINI.md');

      if (!existsSync(homeMdPath)) {
        const omgContent = loadGeminiMdContent();

        // Read existing content if it exists
        let existingContent: string | null = null;
        if (existsSync(geminiMdPath)) {
          existingContent = readFileSync(geminiMdPath, 'utf-8');
        }

        // Always create backup before modification (if file exists)
        if (existingContent !== null) {
          const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]; // YYYY-MM-DDTHH-MM-SS
          const backupPath = join(GEMINI_CONFIG_DIR, `GEMINI.md.backup.${timestamp}`);
          writeFileSync(backupPath, existingContent);
          log(`Backed up existing GEMINI.md to ${backupPath}`);
        }

        // Merge OMG content with existing content
        const mergedContent = mergeGeminiMd(existingContent, omgContent, targetVersion);
        writeFileSync(geminiMdPath, mergedContent);

        if (existingContent) {
          log('Updated GEMINI.md (merged with existing content)');
        } else {
          log('Created GEMINI.md');
        }
      } else {
        log('GEMINI.md exists in home directory, skipping');
      }

      // Note: hook scripts are no longer installed to ~/.gemini/hooks/.
      // All hooks are delivered via the plugin's hooks/hooks.json + scripts/.
      // Legacy hook entries are cleaned up from settings.json below.
      result.hooksConfigured = true; // Will be set properly after consolidated settings.json write
    } else {
      log('Skipping agent/command/hook files (managed by plugin system)');
    }

    // Install HUD statusline (skip for project-scoped plugins, skipHud option, or hudEnabled config)
    let hudScriptPath: string | null = null;
    const hudDisabledByOption = options.skipHud === true;
    const hudDisabledByConfig = !isHudEnabledInConfig();
    const skipHud = projectScoped || hudDisabledByOption || hudDisabledByConfig;
    if (projectScoped) {
      log('Skipping HUD statusline (project-scoped plugin should not modify global settings)');
    } else if (hudDisabledByOption) {
      log('Skipping HUD statusline (user opted out)');
    } else if (hudDisabledByConfig) {
      log('Skipping HUD statusline (hudEnabled is false in .omg-config.json)');
    } else {
      log('Installing HUD statusline...');
    }
    if (!skipHud) try {
      if (!existsSync(HUD_DIR)) {
        mkdirSync(HUD_DIR, { recursive: true });
      }

      // Build the HUD script content (compiled from src/hud/index.ts)
      // Create a wrapper that checks multiple locations for the HUD module
      hudScriptPath = join(HUD_DIR, 'omg-hud.mjs').replace(/\\/g, '/');
      const hudScriptLines = [
        '#!/usr/bin/env node',
        '/**',
        ' * OMG HUD - Statusline Script',
        ' * Wrapper that imports from dev paths, plugin cache, or npm package',
        ' */',
        '',
        'import { existsSync, readdirSync } from "node:fs";',
        'import { homedir } from "node:os";',
        'import { join } from "node:path";',
        'import { pathToFileURL } from "node:url";',
        '',
        'async function main() {',
        '  const home = homedir();',
        '  let pluginCacheVersion = null;',
        '  let pluginCacheDir = null;',
        '  ',
        '  // 1. Development paths (only when OMG_DEV=1)',
        '  if (process.env.OMG_DEV === "1") {',
        '    const devPaths = [',
        '      join(home, "Workspace/oh-my-gemini/dist/hud/index.js"),',
        '      join(home, "workspace/oh-my-gemini/dist/hud/index.js"),',
        '      join(home, "projects/oh-my-gemini/dist/hud/index.js"),',
        '    ];',
        '    ',
        '    for (const devPath of devPaths) {',
        '      if (existsSync(devPath)) {',
        '        try {',
        '          await import(pathToFileURL(devPath).href);',
        '          return;',
        '        } catch { /* continue */ }',
        '      }',
        '    }',
        '  }',
        '  ',
        '  // 2. Plugin cache (for production installs)',
        '  // Respect GEMINI_CONFIG_DIR so installs under a custom config dir are found',
        '  const configDir = process.env.GEMINI_CONFIG_DIR || join(home, ".gemini");',
        '  const pluginCacheBase = join(configDir, "plugins", "cache", "omg", "oh-my-gemini");',
        '  if (existsSync(pluginCacheBase)) {',
        '    try {',
        '      const versions = readdirSync(pluginCacheBase);',
        '      if (versions.length > 0) {',
        '        const sortedVersions = versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();',
        '        const latestInstalledVersion = sortedVersions[0];',
        '        pluginCacheVersion = latestInstalledVersion;',
        '        pluginCacheDir = join(pluginCacheBase, latestInstalledVersion);',
        '        ',
        '        // Filter to only versions with built dist/hud/index.js',
        '        // This prevents picking an unbuilt new version after plugin update',
        '        const builtVersions = sortedVersions.filter(version => {',
        '          const pluginPath = join(pluginCacheBase, version, "dist/hud/index.js");',
        '          return existsSync(pluginPath);',
        '        });',
        '        ',
        '        if (builtVersions.length > 0) {',
        '          const latestVersion = builtVersions[0];',
        '          pluginCacheVersion = latestVersion;',
        '          pluginCacheDir = join(pluginCacheBase, latestVersion);',
        '          const pluginPath = join(pluginCacheDir, "dist/hud/index.js");',
        '          await import(pathToFileURL(pluginPath).href);',
        '          return;',
        '        }',
        '      }',
        '    } catch { /* continue */ }',
        '  }',
        '  ',
        '  // 3. Marketplace clone (for marketplace installs without a populated cache)',
        '  const marketplaceHudPath = join(configDir, "plugins", "marketplaces", "omg", "dist/hud/index.js");',
        '  if (existsSync(marketplaceHudPath)) {',
        '    try {',
        '      await import(pathToFileURL(marketplaceHudPath).href);',
        '      return;',
        '    } catch { /* continue */ }',
        '  }',
        '  ',
        '  // 4. npm package (global or local install)',
        '  try {',
        '    await import("oh-my-gemini/dist/hud/index.js");',
        '    return;',
        '  } catch { /* continue */ }',
        '  ',
        '  // 5. Fallback: provide detailed error message with fix instructions',
        '  if (pluginCacheDir && existsSync(pluginCacheDir)) {',
        '    // Plugin exists but HUD could not be loaded',
        '    const distDir = join(pluginCacheDir, "dist");',
        '    if (!existsSync(distDir)) {',
        '      console.log(`[OMG HUD] Plugin installed but not built. Run: cd "${pluginCacheDir}" && npm install && npm run build`);',
        '    } else {',
        '      console.log(`[OMG HUD] Plugin HUD load failed. Run: cd "${pluginCacheDir}" && npm install && npm run build`);',
        '    }',
        '  } else if (existsSync(pluginCacheBase)) {',
        '    // Plugin cache directory exists but no versions',
        '    console.log(`[OMG HUD] Plugin cache found but no versions installed. Run: /oh-my-gemini:omg-setup`);',
        '  } else {',
        '    // No plugin installation found at all',
        '    console.log("[OMG HUD] Plugin not installed. Run: /oh-my-gemini:omg-setup");',
        '  }',
        '}',
        '',
        'main();',
      ];
      const hudScript = hudScriptLines.join('\n');

      writeFileSync(hudScriptPath, hudScript);
      if (!isWindows()) {
        chmodSync(hudScriptPath, 0o755);
      }
      log('  Installed omg-hud.mjs');
    } catch (_e) {
      log('  Warning: Could not install HUD statusline script (non-fatal)');
      hudScriptPath = null;
    }

    // Consolidated settings.json write (atomic: read once, modify, write once)
    // Skip for project-scoped plugins to avoid affecting global settings
    if (projectScoped) {
      log('Skipping settings.json configuration (project-scoped plugin)');
    } else {
      log('Configuring settings.json...');
    }
    if (!projectScoped) try {
      let existingSettings: Record<string, unknown> = {};
      if (existsSync(SETTINGS_FILE)) {
        const settingsContent = readFileSync(SETTINGS_FILE, 'utf-8');
        existingSettings = JSON.parse(settingsContent);
      }

      // 1. Remove legacy ~/.gemini/hooks/ entries from settings.json
      // These were written by the old installer; hooks are now delivered via the plugin's hooks.json.
      {
        type HookEntry = { type: string; command: string };
        type HookGroup = { hooks: HookEntry[] };
        const existingHooks = (existingSettings.hooks || {}) as Record<string, unknown>;
        let legacyRemoved = 0;

        for (const [eventType, groups] of Object.entries(existingHooks)) {
          const groupList = groups as HookGroup[];
          const filtered = groupList.filter(group => {
            const isLegacy = group.hooks.every(h =>
              h.type === 'command' && h.command.includes('/.gemini/hooks/')
            );
            if (isLegacy) legacyRemoved++;
            return !isLegacy;
          });
          if (filtered.length === 0) {
            delete existingHooks[eventType];
          } else {
            existingHooks[eventType] = filtered;
          }
        }

        if (legacyRemoved > 0) {
          log(`  Cleaned up ${legacyRemoved} legacy hook entries from settings.json`);
        }

        existingSettings.hooks = Object.keys(existingHooks).length > 0 ? existingHooks : undefined;
        result.hooksConfigured = true;
      }

      // 2. Configure statusLine (always, even in plugin mode)
      if (hudScriptPath) {
        const nodeBin = resolveNodeBinary();
        const absoluteCommand = '"' + nodeBin + '" "' + hudScriptPath.replace(/\\/g, '/') + '"';

        // On Unix, use find-node.sh for portable $HOME paths (multi-machine sync)
        // and robust node discovery (nvm/fnm in non-interactive shells).
        // Copy find-node.sh into the HUD directory so statusLine can reference it
        // without depending on GEMINI_PLUGIN_ROOT (which is only set for hooks).
        let statusLineCommand = absoluteCommand;
        if (!isWindows()) {
          try {
            const findNodeSrc = join(__dirname, '..', '..', 'scripts', 'find-node.sh');
            const findNodeDest = join(HUD_DIR, 'find-node.sh');
            copyFileSync(findNodeSrc, findNodeDest);
            chmodSync(findNodeDest, 0o755);
            statusLineCommand = 'sh $HOME/.gemini/hud/find-node.sh $HOME/.gemini/hud/omg-hud.mjs';
          } catch {
            // Fallback to bare node if find-node.sh copy fails
            statusLineCommand = 'node $HOME/.gemini/hud/omg-hud.mjs';
          }
        }
        // Auto-migrate legacy string format (pre-v4.5) to object format
        const needsMigration = typeof existingSettings.statusLine === 'string'
          && isOmgStatusLine(existingSettings.statusLine);
        if (!existingSettings.statusLine || needsMigration) {
          existingSettings.statusLine = {
            type: 'command',
            command: statusLineCommand
          };
          log(needsMigration
            ? '  Migrated statusLine from legacy string to object format'
            : '  Configured statusLine');
        } else if (options.force && isOmgStatusLine(existingSettings.statusLine)) {
          existingSettings.statusLine = {
            type: 'command',
            command: statusLineCommand
          };
          log('  Updated statusLine (--force)');
        } else if (options.force) {
          log('  statusLine owned by another tool, preserving (use manual edit to override)');
        } else {
          log('  statusLine already configured, skipping (use --force to override)');
        }
      }

      // 3. Persist the detected node binary path into .omg-config.json so that
      //    find-node.sh (used in hooks/hooks.json) can locate it at hook runtime
      //    even when node is not on PATH (nvm/fnm users, issue #892).
      try {
        const configPath = join(GEMINI_CONFIG_DIR, '.omg-config.json');
        let omgConfig: Record<string, unknown> = {};
        if (existsSync(configPath)) {
          omgConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
        }
        const detectedNode = resolveNodeBinary();
        if (detectedNode !== 'node') {
          omgConfig.nodeBinary = detectedNode;
          writeFileSync(configPath, JSON.stringify(omgConfig, null, 2));
          log(`  Saved node binary path to .omg-config.json: ${detectedNode}`);
        }
      } catch {
        log('  Warning: Could not save node binary path (non-fatal)');
      }

      // 4. Sync unified MCP registry into Gemini + Gemini config surfaces
      const mcpSync = syncUnifiedMcpRegistryTargets(existingSettings);
      existingSettings = mcpSync.settings;
      if (mcpSync.result.bootstrappedFromGemini) {
        log(`  Bootstrapped unified MCP registry: ${mcpSync.result.registryPath}`);
      }
      if (mcpSync.result.geminiChanged) {
        log(`  Synced ${mcpSync.result.serverNames.length} MCP server(s) into Gemini MCP config: ${mcpSync.result.geminiConfigPath}`);
      }
      if (mcpSync.result.geminiChanged) {
        log(`  Synced ${mcpSync.result.serverNames.length} MCP server(s) into Gemini config: ${mcpSync.result.geminiConfigPath}`);
      }

      // 5. Single atomic write
      writeFileSync(SETTINGS_FILE, JSON.stringify(existingSettings, null, 2));
      log('  settings.json updated');
    } catch (_e) {
      log('  Warning: Could not configure settings.json (non-fatal)');
      result.hooksConfigured = false;
    }

    // Save version metadata (skip for project-scoped plugins)
    if (!projectScoped) {
      const versionMetadata = {
        version: targetVersion,
        installedAt: new Date().toISOString(),
        installMethod: 'npm' as const,
        lastCheckAt: new Date().toISOString()
      };
      writeFileSync(VERSION_FILE, JSON.stringify(versionMetadata, null, 2));
      log('Saved version metadata');
    } else {
      log('Skipping version metadata (project-scoped plugin)');
    }

    try {
      const setupVersionSynced = syncPersistedSetupVersion({
        version: options.version ?? VERSION,
        onlyIfConfigured: true,
      });
      if (setupVersionSynced) {
        log('Updated persisted setupVersion');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`  Warning: Could not refresh setupVersion metadata (non-fatal): ${message}`);
    }

    result.success = true;
    result.message = `Successfully installed ${result.installedAgents.length} agents, ${result.installedCommands.length} commands, ${result.installedSkills.length} skills (hooks delivered via plugin)`;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    result.message = `Installation failed: ${errorMessage}`;
  }

  return result;
}

/**
 * Check if OMG is already installed
 */
export function isInstalled(): boolean {
  return existsSync(VERSION_FILE) && (existsSync(AGENTS_DIR) || hasPluginProvidedAgentFiles());
}

/**
 * Get installation info
 */
export function getInstallInfo(): { version: string; installedAt: string; method: string } | null {
  if (!existsSync(VERSION_FILE)) {
    return null;
  }
  try {
    const content = readFileSync(VERSION_FILE, 'utf-8');
    const data = JSON.parse(content);
    return {
      version: data.version,
      installedAt: data.installedAt,
      method: data.installMethod
    };
  } catch {
    return null;
  }
}
