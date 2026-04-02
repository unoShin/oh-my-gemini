#!/usr/bin/env node
/**
 * Oh-My-GeminiCode CLI
 *
 * Command-line interface for the OMG multi-agent system.
 *
 * Commands:
 * - run: Start an interactive session
 * - config: Show or edit configuration
 * - setup: Sync all OMG components (hooks, agents, skills)
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync, existsSync } from 'fs';
import { loadConfig, getConfigPaths, } from '../config/loader.js';
import { createOmgSession } from '../index.js';
import { checkForUpdates, performUpdate, formatUpdateNotification, getInstalledVersion, getOMGConfig, reconcileUpdateRuntime, CONFIG_FILE, } from '../features/auto-update.js';
import { install as installOmg, isInstalled, getInstallInfo } from '../installer/index.js';
import { waitCommand, waitStatusCommand, waitDaemonCommand, waitDetectCommand } from './commands/wait.js';
import { doctorConflictsCommand } from './commands/doctor-conflicts.js';
import { sessionSearchCommand } from './commands/session-search.js';
import { teamCommand } from './commands/team.js';
import { ralphthonCommand } from './commands/ralphthon.js';
import { teleportCommand, teleportListCommand, teleportRemoveCommand } from './commands/teleport.js';
import { getRuntimePackageVersion } from '../lib/version.js';
import { launchCommand } from './launch.js';
import { interopCommand } from './interop.js';
import { askCommand, ASK_USAGE } from './ask.js';
import { warnIfWin32 } from './win32-warning.js';
import { autoresearchCommand } from './autoresearch.js';
import { runHudWatchLoop } from './hud-watch.js';
const version = getRuntimePackageVersion();
const program = new Command();
// Win32 platform warning - OMG requires tmux which is not available on native Windows
warnIfWin32();
// Default action when running 'omg' with no subcommand
// Forwards all args to launchCommand so 'omg --notify false --madmax' etc. work directly
async function defaultAction() {
    // Pass all CLI args through to launch (strip node + script path)
    const args = process.argv.slice(2);
    // Defensive fallback: wrapper/bridge invocations must preserve explicit ask routing
    // so nested Gemini launch checks only apply to actual Gemini launches.
    if (args[0] === 'ask') {
        await askCommand(args.slice(1));
        return;
    }
    await launchCommand(args);
}
program
    .name('omg')
    .description('Multi-agent orchestration system for Gemini Agent SDK')
    .version(version)
    .allowUnknownOption()
    .action(defaultAction);
/**
 * Launch command - Native tmux shell launch for Gemini Code
 */
program
    .command('launch [args...]')
    .description('Launch Gemini Code with native tmux shell integration')
    .allowUnknownOption()
    .addHelpText('after', `
Examples:
  $ omg                                Launch Gemini Code
  $ omg --madmax                       Launch with permissions bypass
  $ omg --yolo                         Launch with permissions bypass (alias)
  $ omg --notify false                 Launch without CCNotifier events
  $ omg launch                         Explicit launch subcommand (same as bare omg)
  $ omg launch --madmax                Explicit launch with flags

Options:
  --notify <bool>   Enable/disable CCNotifier events. false sets OMG_NOTIFY=0
                    and suppresses all stop/session-start/session-idle notifications.
                    Default: true

Environment:
  OMG_NOTIFY=0              Suppress all notifications (set by --notify false)
`)
    .action(async (args) => {
    await launchCommand(args);
});
/**
 * Interop command - Split-pane tmux session with OMG and OMX
 */
program
    .command('interop')
    .description('Launch split-pane tmux session with Gemini Code (OMG) and Gemini (OMX)')
    .addHelpText('after', `
Requirements:
  - Must be running inside a tmux session
  - Gemini CLI must be installed
  - Gemini CLI recommended (graceful fallback if missing)`)
    .action(() => {
    interopCommand();
});
/**
 * Ask command - Run provider advisor prompt (gemini|gemini)
 */
program
    .command('ask [args...]')
    .description('Run provider advisor prompt and write an ask artifact')
    .allowUnknownOption()
    .addHelpText('after', `\n${ASK_USAGE}`)
    .action(async (args) => {
    await askCommand(args || []);
});
/**
 * Config command - Show or validate configuration
 */
program
    .command('config')
    .description('Show current configuration')
    .option('-v, --validate', 'Validate configuration')
    .option('-p, --paths', 'Show configuration file paths')
    .addHelpText('after', `
Examples:
  $ omg config                   Show current configuration
  $ omg config --validate        Validate configuration files
  $ omg config --paths           Show config file locations

  }`)
    .action(async (options) => {
    if (options.paths) {
        const paths = getConfigPaths();
        console.log(chalk.blue('Configuration file paths:'));
        console.log(`  User:    ${paths.user}`);
        console.log(`  Project: ${paths.project}`);
        console.log(chalk.blue('\nFile status:'));
        console.log(`  User:    ${existsSync(paths.user) ? chalk.green('exists') : chalk.gray('not found')}`);
        console.log(`  Project: ${existsSync(paths.project) ? chalk.green('exists') : chalk.gray('not found')}`);
        return;
    }
    const config = loadConfig();
    if (options.validate) {
        console.log(chalk.blue('Validating configuration...\n'));
        // Check for required fields
        const warnings = [];
        const errors = [];
        if (!process.env.ANTHROPIC_API_KEY) {
            warnings.push('ANTHROPIC_API_KEY environment variable not set');
        }
        if (config.mcpServers?.exa?.enabled && !process.env.EXA_API_KEY && !config.mcpServers.exa.apiKey) {
            warnings.push('Exa is enabled but EXA_API_KEY is not set');
        }
        if (errors.length > 0) {
            console.log(chalk.red('Errors:'));
            errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
        }
        if (warnings.length > 0) {
            console.log(chalk.yellow('Warnings:'));
            warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
        }
        if (errors.length === 0 && warnings.length === 0) {
            console.log(chalk.green('Configuration is valid!'));
        }
        return;
    }
    console.log(chalk.blue('Current configuration:\n'));
    console.log(JSON.stringify(config, null, 2));
});
/**
 * Config stop-callback subcommand - Configure stop hook callbacks
 */
const _configStopCallback = program
    .command('config-stop-callback <type>')
    .description('Configure stop hook callbacks (file/telegram/discord/slack)')
    .option('--enable', 'Enable callback')
    .option('--disable', 'Disable callback')
    .option('--path <path>', 'File path (supports {session_id}, {date}, {time})')
    .option('--format <format>', 'File format: markdown | json')
    .option('--token <token>', 'Bot token (telegram or discord-bot)')
    .option('--chat <id>', 'Telegram chat ID')
    .option('--webhook <url>', 'Discord webhook URL')
    .option('--channel-id <id>', 'Discord bot channel ID (used with --profile)')
    .option('--tag-list <csv>', 'Replace tag list (comma-separated, telegram/discord only)')
    .option('--add-tag <tag>', 'Append one tag (telegram/discord only)')
    .option('--remove-tag <tag>', 'Remove one tag (telegram/discord only)')
    .option('--clear-tags', 'Clear all tags (telegram/discord only)')
    .option('--profile <name>', 'Named notification profile to configure')
    .option('--show', 'Show current configuration')
    .addHelpText('after', `
Types:
  file       File system callback (saves session summary to disk)
  telegram   Telegram bot notification
  discord    Discord webhook notification
  slack      Slack incoming webhook notification

Profile types (use with --profile):
  discord-bot  Discord Bot API (token + channel ID)
  slack        Slack incoming webhook
  webhook      Generic webhook (POST with JSON body)

Examples:
  $ omg config-stop-callback file --enable --path ~/.gemini/logs/{date}.md
  $ omg config-stop-callback telegram --enable --token <token> --chat <id>
  $ omg config-stop-callback discord --enable --webhook <url>
  $ omg config-stop-callback file --disable
  $ omg config-stop-callback file --show

  # Named profiles (stored in notificationProfiles):
  $ omg config-stop-callback discord --profile work --enable --webhook <url>
  $ omg config-stop-callback telegram --profile work --enable --token <tk> --chat <id>
  $ omg config-stop-callback discord-bot --profile ops --enable --token <tk> --channel-id <id>

  # Select profile at launch:
  $ OMG_NOTIFY_PROFILE=work gemini`)
    .action(async (type, options) => {
    // When --profile is used, route to profile-based config
    if (options.profile) {
        const profileValidTypes = ['file', 'telegram', 'discord', 'discord-bot', 'slack', 'webhook'];
        if (!profileValidTypes.includes(type)) {
            console.error(chalk.red(`Invalid type for profile: ${type}`));
            console.error(chalk.gray(`Valid types: ${profileValidTypes.join(', ')}`));
            process.exit(1);
        }
        const config = getOMGConfig();
        config.notificationProfiles = config.notificationProfiles || {};
        const profileName = options.profile;
        const profile = config.notificationProfiles[profileName] || { enabled: true };
        // Show current profile config
        if (options.show) {
            if (config.notificationProfiles[profileName]) {
                console.log(chalk.blue(`Profile "${profileName}" — ${type} configuration:`));
                const platformConfig = profile[type];
                if (platformConfig) {
                    console.log(JSON.stringify(platformConfig, null, 2));
                }
                else {
                    console.log(chalk.yellow(`No ${type} platform configured in profile "${profileName}".`));
                }
            }
            else {
                console.log(chalk.yellow(`Profile "${profileName}" not found.`));
            }
            return;
        }
        let enabled;
        if (options.enable)
            enabled = true;
        else if (options.disable)
            enabled = false;
        switch (type) {
            case 'discord': {
                const current = profile.discord;
                if (enabled === true && (!options.webhook && !current?.webhookUrl)) {
                    console.error(chalk.red('Discord requires --webhook <webhook_url>'));
                    process.exit(1);
                }
                profile.discord = {
                    ...current,
                    enabled: enabled ?? current?.enabled ?? false,
                    webhookUrl: options.webhook ?? current?.webhookUrl,
                };
                break;
            }
            case 'discord-bot': {
                const current = profile['discord-bot'];
                if (enabled === true && (!options.token && !current?.botToken)) {
                    console.error(chalk.red('Discord bot requires --token <bot_token>'));
                    process.exit(1);
                }
                if (enabled === true && (!options.channelId && !current?.channelId)) {
                    console.error(chalk.red('Discord bot requires --channel-id <channel_id>'));
                    process.exit(1);
                }
                profile['discord-bot'] = {
                    ...current,
                    enabled: enabled ?? current?.enabled ?? false,
                    botToken: options.token ?? current?.botToken,
                    channelId: options.channelId ?? current?.channelId,
                };
                break;
            }
            case 'telegram': {
                const current = profile.telegram;
                if (enabled === true && (!options.token && !current?.botToken)) {
                    console.error(chalk.red('Telegram requires --token <bot_token>'));
                    process.exit(1);
                }
                if (enabled === true && (!options.chat && !current?.chatId)) {
                    console.error(chalk.red('Telegram requires --chat <chat_id>'));
                    process.exit(1);
                }
                profile.telegram = {
                    ...current,
                    enabled: enabled ?? current?.enabled ?? false,
                    botToken: options.token ?? current?.botToken,
                    chatId: options.chat ?? current?.chatId,
                };
                break;
            }
            case 'slack': {
                const current = profile.slack;
                if (enabled === true && (!options.webhook && !current?.webhookUrl)) {
                    console.error(chalk.red('Slack requires --webhook <webhook_url>'));
                    process.exit(1);
                }
                profile.slack = {
                    ...current,
                    enabled: enabled ?? current?.enabled ?? false,
                    webhookUrl: options.webhook ?? current?.webhookUrl,
                };
                break;
            }
            case 'webhook': {
                const current = profile.webhook;
                if (enabled === true && (!options.webhook && !current?.url)) {
                    console.error(chalk.red('Webhook requires --webhook <url>'));
                    process.exit(1);
                }
                profile.webhook = {
                    ...current,
                    enabled: enabled ?? current?.enabled ?? false,
                    url: options.webhook ?? current?.url,
                };
                break;
            }
            case 'file': {
                console.error(chalk.yellow('File callbacks are not supported in notification profiles.'));
                console.error(chalk.gray('Use without --profile for file callbacks.'));
                process.exit(1);
                break;
            }
        }
        config.notificationProfiles[profileName] = profile;
        try {
            writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
            console.log(chalk.green(`\u2713 Profile "${profileName}" — ${type} configured`));
            console.log(JSON.stringify(profile[type], null, 2));
        }
        catch (error) {
            console.error(chalk.red('Failed to write configuration:'), error);
            process.exit(1);
        }
        return;
    }
    // Legacy (non-profile) path
    const validTypes = ['file', 'telegram', 'discord', 'slack'];
    if (!validTypes.includes(type)) {
        console.error(chalk.red(`Invalid callback type: ${type}`));
        console.error(chalk.gray(`Valid types: ${validTypes.join(', ')}`));
        process.exit(1);
    }
    const config = getOMGConfig();
    config.stopHookCallbacks = config.stopHookCallbacks || {};
    // Show current config
    if (options.show) {
        const current = config.stopHookCallbacks[type];
        if (current) {
            console.log(chalk.blue(`Current ${type} callback configuration:`));
            console.log(JSON.stringify(current, null, 2));
        }
        else {
            console.log(chalk.yellow(`No ${type} callback configured.`));
        }
        return;
    }
    // Determine enabled state
    let enabled;
    if (options.enable) {
        enabled = true;
    }
    else if (options.disable) {
        enabled = false;
    }
    const hasTagListChanges = options.tagList !== undefined
        || options.addTag !== undefined
        || options.removeTag !== undefined
        || options.clearTags;
    const parseTagList = (value) => value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    const resolveTagList = (currentTagList) => {
        let next = options.tagList !== undefined
            ? parseTagList(options.tagList)
            : [...(currentTagList ?? [])];
        if (options.clearTags) {
            next = [];
        }
        if (options.addTag !== undefined) {
            const tagToAdd = String(options.addTag).trim();
            if (tagToAdd && !next.includes(tagToAdd)) {
                next.push(tagToAdd);
            }
        }
        if (options.removeTag !== undefined) {
            const tagToRemove = String(options.removeTag).trim();
            if (tagToRemove) {
                next = next.filter((tag) => tag !== tagToRemove);
            }
        }
        return next;
    };
    // Update config based on type
    switch (type) {
        case 'file': {
            const current = config.stopHookCallbacks.file;
            config.stopHookCallbacks.file = {
                enabled: enabled ?? current?.enabled ?? false,
                path: options.path ?? current?.path ?? '~/.gemini/session-logs/{session_id}.md',
                format: options.format ?? current?.format ?? 'markdown',
            };
            break;
        }
        case 'telegram': {
            const current = config.stopHookCallbacks.telegram;
            if (enabled === true && (!options.token && !current?.botToken)) {
                console.error(chalk.red('Telegram requires --token <bot_token>'));
                process.exit(1);
            }
            if (enabled === true && (!options.chat && !current?.chatId)) {
                console.error(chalk.red('Telegram requires --chat <chat_id>'));
                process.exit(1);
            }
            config.stopHookCallbacks.telegram = {
                ...current,
                enabled: enabled ?? current?.enabled ?? false,
                botToken: options.token ?? current?.botToken,
                chatId: options.chat ?? current?.chatId,
                tagList: hasTagListChanges ? resolveTagList(current?.tagList) : current?.tagList,
            };
            break;
        }
        case 'discord': {
            const current = config.stopHookCallbacks.discord;
            if (enabled === true && (!options.webhook && !current?.webhookUrl)) {
                console.error(chalk.red('Discord requires --webhook <webhook_url>'));
                process.exit(1);
            }
            config.stopHookCallbacks.discord = {
                ...current,
                enabled: enabled ?? current?.enabled ?? false,
                webhookUrl: options.webhook ?? current?.webhookUrl,
                tagList: hasTagListChanges ? resolveTagList(current?.tagList) : current?.tagList,
            };
            break;
        }
        case 'slack': {
            const current = config.stopHookCallbacks.slack;
            if (enabled === true && (!options.webhook && !current?.webhookUrl)) {
                console.error(chalk.red('Slack requires --webhook <webhook_url>'));
                process.exit(1);
            }
            config.stopHookCallbacks.slack = {
                ...current,
                enabled: enabled ?? current?.enabled ?? false,
                webhookUrl: options.webhook ?? current?.webhookUrl,
                tagList: hasTagListChanges ? resolveTagList(current?.tagList) : current?.tagList,
            };
            break;
        }
    }
    // Write config
    try {
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        console.log(chalk.green(`\u2713 Stop callback '${type}' configured`));
        console.log(JSON.stringify(config.stopHookCallbacks[type], null, 2));
    }
    catch (error) {
        console.error(chalk.red('Failed to write configuration:'), error);
        process.exit(1);
    }
});
/**
 * Config notify-profile subcommand - List, show, and delete notification profiles
 */
program
    .command('config-notify-profile [name]')
    .description('Manage notification profiles')
    .option('--list', 'List all profiles')
    .option('--show', 'Show profile configuration')
    .option('--delete', 'Delete a profile')
    .addHelpText('after', `
Examples:
  $ omg config-notify-profile --list
  $ omg config-notify-profile work --show
  $ omg config-notify-profile work --delete

  # Create/update profiles via config-stop-callback --profile:
  $ omg config-stop-callback discord --profile work --enable --webhook <url>

  # Select profile at launch:
  $ OMG_NOTIFY_PROFILE=work gemini`)
    .action(async (name, options) => {
    const config = getOMGConfig();
    const profiles = config.notificationProfiles || {};
    if (options.list || !name) {
        const names = Object.keys(profiles);
        if (names.length === 0) {
            console.log(chalk.yellow('No notification profiles configured.'));
            console.log(chalk.gray('Create one with: omg config-stop-callback <type> --profile <name> --enable ...'));
        }
        else {
            console.log(chalk.blue('Notification profiles:'));
            for (const pName of names) {
                const p = profiles[pName];
                const platforms = ['discord', 'discord-bot', 'telegram', 'slack', 'webhook']
                    .filter((plat) => p[plat]?.enabled)
                    .join(', ');
                const status = p.enabled !== false ? chalk.green('enabled') : chalk.red('disabled');
                console.log(`  ${chalk.bold(pName)} [${status}] — ${platforms || 'no platforms'}`);
            }
        }
        const activeProfile = process.env.OMG_NOTIFY_PROFILE;
        if (activeProfile) {
            console.log(chalk.gray(`\nActive profile (OMG_NOTIFY_PROFILE): ${activeProfile}`));
        }
        return;
    }
    if (options.show) {
        if (profiles[name]) {
            console.log(chalk.blue(`Profile "${name}":`));
            console.log(JSON.stringify(profiles[name], null, 2));
        }
        else {
            console.log(chalk.yellow(`Profile "${name}" not found.`));
        }
        return;
    }
    if (options.delete) {
        if (!profiles[name]) {
            console.log(chalk.yellow(`Profile "${name}" not found.`));
            return;
        }
        delete profiles[name];
        config.notificationProfiles = profiles;
        if (Object.keys(profiles).length === 0) {
            delete config.notificationProfiles;
        }
        try {
            writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
            console.log(chalk.green(`\u2713 Profile "${name}" deleted`));
        }
        catch (error) {
            console.error(chalk.red('Failed to write configuration:'), error);
            process.exit(1);
        }
        return;
    }
    // Default: show the named profile
    if (profiles[name]) {
        console.log(chalk.blue(`Profile "${name}":`));
        console.log(JSON.stringify(profiles[name], null, 2));
    }
    else {
        console.log(chalk.yellow(`Profile "${name}" not found.`));
        console.log(chalk.gray('Create it with: omg config-stop-callback <type> --profile ' + name + ' --enable ...'));
    }
});
/**
 * Info command - Show system information
 */
program
    .command('info')
    .description('Show system and agent information')
    .addHelpText('after', `
Examples:
  $ omg info                     Show agents, features, and MCP servers`)
    .action(async () => {
    const session = createOmgSession();
    console.log(chalk.blue.bold('\nOh-My-GeminiCode System Information\n'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.blue('\nAvailable Agents:'));
    const agents = session.queryOptions.options.agents;
    for (const [name, agent] of Object.entries(agents)) {
        console.log(`  ${chalk.green(name)}`);
        console.log(`    ${chalk.gray(agent.description.split('\n')[0])}`);
    }
    console.log(chalk.blue('\nEnabled Features:'));
    const features = session.config.features;
    if (features) {
        console.log(`  Parallel Execution:      ${features.parallelExecution ? chalk.green('enabled') : chalk.gray('disabled')}`);
        console.log(`  LSP Tools:               ${features.lspTools ? chalk.green('enabled') : chalk.gray('disabled')}`);
        console.log(`  AST Tools:               ${features.astTools ? chalk.green('enabled') : chalk.gray('disabled')}`);
        console.log(`  Continuation Enforcement:${features.continuationEnforcement ? chalk.green('enabled') : chalk.gray('disabled')}`);
        console.log(`  Auto Context Injection:  ${features.autoContextInjection ? chalk.green('enabled') : chalk.gray('disabled')}`);
    }
    console.log(chalk.blue('\nMCP Servers:'));
    const mcpServers = session.queryOptions.options.mcpServers;
    for (const name of Object.keys(mcpServers)) {
        console.log(`  ${chalk.green(name)}`);
    }
    console.log(chalk.blue('\nMagic Keywords:'));
    console.log(`  Ultrawork: ${chalk.cyan(session.config.magicKeywords?.ultrawork?.join(', ') ?? 'ultrawork, ulw, uw')}`);
    console.log(`  Search:    ${chalk.cyan(session.config.magicKeywords?.search?.join(', ') ?? 'search, find, locate')}`);
    console.log(`  Analyze:   ${chalk.cyan(session.config.magicKeywords?.analyze?.join(', ') ?? 'analyze, investigate, examine')}`);
    console.log(chalk.gray('\n━'.repeat(50)));
    console.log(chalk.gray(`Version: ${version}`));
});
/**
 * Test command - Test prompt enhancement
 */
program
    .command('test-prompt <prompt>')
    .description('Test how a prompt would be enhanced')
    .addHelpText('after', `
Examples:
  $ omg test-prompt "ultrawork fix bugs"    See how magic keywords are detected
  $ omg test-prompt "analyze this code"     Test prompt enhancement`)
    .action(async (prompt) => {
    const session = createOmgSession();
    console.log(chalk.blue('Original prompt:'));
    console.log(chalk.gray(prompt));
    const keywords = session.detectKeywords(prompt);
    if (keywords.length > 0) {
        console.log(chalk.blue('\nDetected magic keywords:'));
        console.log(chalk.yellow(keywords.join(', ')));
    }
    console.log(chalk.blue('\nEnhanced prompt:'));
    console.log(chalk.green(session.processPrompt(prompt)));
});
/**
 * Update command - Check for and install updates
 */
program
    .command('update')
    .description('Check for and install updates')
    .option('-c, --check', 'Only check for updates, do not install')
    .option('-f, --force', 'Force reinstall even if up to date')
    .option('-q, --quiet', 'Suppress output except for errors')
    .option('--standalone', 'Force npm update even in plugin context')
    .option('--clean', 'Purge old plugin cache versions immediately (bypass 24h grace period)')
    .addHelpText('after', `
Examples:
  $ omg update                   Check and install updates
  $ omg update --check           Only check, don't install
  $ omg update --force           Force reinstall
  $ omg update --standalone      Force npm update in plugin context`)
    .action(async (options) => {
    if (!options.quiet) {
        console.log(chalk.blue('Oh-My-GeminiCode Update\n'));
    }
    try {
        // Show current version
        const installed = getInstalledVersion();
        if (!options.quiet) {
            console.log(chalk.gray(`Current version: ${installed?.version ?? 'unknown'}`));
            console.log(chalk.gray(`Install method: ${installed?.installMethod ?? 'unknown'}`));
            console.log('');
        }
        // Check for updates
        if (!options.quiet) {
            console.log('Checking for updates...');
        }
        const checkResult = await checkForUpdates();
        if (!checkResult.updateAvailable && !options.force) {
            if (!options.quiet) {
                console.log(chalk.green(`\n✓ You are running the latest version (${checkResult.currentVersion})`));
            }
            return;
        }
        if (!options.quiet) {
            console.log(formatUpdateNotification(checkResult));
        }
        // If check-only mode, stop here
        if (options.check) {
            if (checkResult.updateAvailable) {
                console.log(chalk.yellow('\nRun without --check to install the update.'));
            }
            return;
        }
        // Perform the update
        if (!options.quiet) {
            console.log(chalk.blue('\nStarting update...\n'));
        }
        const result = await performUpdate({ verbose: !options.quiet, standalone: options.standalone, clean: options.clean });
        if (result.success) {
            if (!options.quiet) {
                console.log(chalk.green(`\n✓ ${result.message}`));
                console.log(chalk.gray('\nPlease restart your Gemini Code session to use the new version.'));
            }
        }
        else {
            console.error(chalk.red(`\n✗ ${result.message}`));
            if (result.errors) {
                result.errors.forEach(err => console.error(chalk.red(`  - ${err}`)));
            }
            process.exit(1);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Update failed: ${message}`));
        console.error(chalk.gray('Try again with "omg update --force", or reinstall with "omg install --force".'));
        process.exit(1);
    }
});
/**
 * Update reconcile command - Internal command for post-update reconciliation
 * Called automatically after npm install to ensure hooks/settings are updated with NEW code
 */
program
    .command('update-reconcile')
    .description('Internal: Reconcile runtime state after update (called by update command)')
    .option('-v, --verbose', 'Show detailed output')
    .option('--skip-grace-period', 'Bypass 24h grace period for cache purge')
    .action(async (options) => {
    try {
        const reconcileResult = reconcileUpdateRuntime({ verbose: options.verbose, skipGracePeriod: options.skipGracePeriod });
        if (!reconcileResult.success) {
            console.error(chalk.red('Reconciliation failed:'));
            if (reconcileResult.errors) {
                reconcileResult.errors.forEach(err => console.error(chalk.red(`  - ${err}`)));
            }
            process.exit(1);
        }
        if (options.verbose) {
            console.log(chalk.green(reconcileResult.message));
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Reconciliation error: ${message}`));
        process.exit(1);
    }
});
/**
 * Version command - Show version information
 */
program
    .command('version')
    .description('Show detailed version information')
    .addHelpText('after', `
Examples:
  $ omg version                  Show version, install method, and commit hash`)
    .action(async () => {
    const installed = getInstalledVersion();
    console.log(chalk.blue.bold('\nOh-My-GeminiCode Version Information\n'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(`\n  Package version:   ${chalk.green(version)}`);
    if (installed) {
        console.log(`  Installed version: ${chalk.green(installed.version)}`);
        console.log(`  Install method:    ${chalk.cyan(installed.installMethod)}`);
        console.log(`  Installed at:      ${chalk.gray(installed.installedAt)}`);
        if (installed.lastCheckAt) {
            console.log(`  Last update check: ${chalk.gray(installed.lastCheckAt)}`);
        }
        if (installed.commitHash) {
            console.log(`  Commit hash:       ${chalk.gray(installed.commitHash)}`);
        }
    }
    else {
        console.log(chalk.yellow('  No installation metadata found'));
        console.log(chalk.gray('  (Run the install script to create version metadata)'));
    }
    console.log(chalk.gray('\n━'.repeat(50)));
    console.log(chalk.gray('\nTo check for updates, run: oh-my-gemini update --check'));
});
/**
 * Install command - Install agents and commands to ~/.gemini/
 */
program
    .command('install')
    .description('Install OMG agents and commands to Gemini Code config (~/.gemini/)')
    .option('-f, --force', 'Overwrite existing files')
    .option('-q, --quiet', 'Suppress output except for errors')
    .option('--skip-gemini-check', 'Skip checking if Gemini Code is installed')
    .addHelpText('after', `
Examples:
  $ omg install                  Install to ~/.gemini/
  $ omg install --force          Reinstall, overwriting existing files
  $ omg install --quiet          Silent install for scripts`)
    .action(async (options) => {
    if (!options.quiet) {
        console.log(chalk.blue('╔═══════════════════════════════════════════════════════════╗'));
        console.log(chalk.blue('║         Oh-My-GeminiCode Installer                        ║'));
        console.log(chalk.blue('║   Multi-Agent Orchestration for Gemini Code               ║'));
        console.log(chalk.blue('╚═══════════════════════════════════════════════════════════╝'));
        console.log('');
    }
    // Check if already installed
    if (isInstalled() && !options.force) {
        const info = getInstallInfo();
        if (!options.quiet) {
            console.log(chalk.yellow('OMG is already installed.'));
            if (info) {
                console.log(chalk.gray(`  Version: ${info.version}`));
                console.log(chalk.gray(`  Installed: ${info.installedAt}`));
            }
            console.log(chalk.gray('\nUse --force to reinstall.'));
        }
        return;
    }
    // Run installation
    const result = installOmg({
        force: options.force,
        verbose: !options.quiet,
        skipGeminiCheck: options.skipGeminiCheck
    });
    if (result.success) {
        if (!options.quiet) {
            console.log('');
            console.log(chalk.green('╔═══════════════════════════════════════════════════════════╗'));
            console.log(chalk.green('║         Installation Complete!                            ║'));
            console.log(chalk.green('╚═══════════════════════════════════════════════════════════╝'));
            console.log('');
            console.log(chalk.gray(`Installed to: ~/.gemini/`));
            console.log('');
            console.log(chalk.yellow('Usage:'));
            console.log('  gemini                        # Start Gemini Code normally');
            console.log('');
            console.log(chalk.yellow('Slash Commands:'));
            console.log('  /omg <task>              # Activate OMG orchestration mode');
            console.log('  /omg-default             # Configure for current project');
            console.log('  /omg-default-global      # Configure globally');
            console.log('  /ultrawork <task>             # Maximum performance mode');
            console.log('  /deepsearch <query>           # Thorough codebase search');
            console.log('  /analyze <target>             # Deep analysis mode');
            console.log('  /plan <description>           # Start planning with Planner');
            console.log('  /review [plan-path]           # Review plan with Critic');
            console.log('');
            console.log(chalk.yellow('Available Agents (via Task tool):'));
            console.log(chalk.gray('  Base Agents:'));
            console.log('    architect              - Architecture & debugging (Ultra)');
            console.log('    document-specialist   - External docs & reference lookup (Pro)');
            console.log('    explore             - Fast pattern matching (Flash)');
            console.log('    designer            - UI/UX specialist (Pro)');
            console.log('    writer              - Technical writing (Flash)');
            console.log('    vision              - Visual analysis (Pro)');
            console.log('    critic               - Plan review (Ultra)');
            console.log('    analyst               - Pre-planning analysis (Ultra)');
            console.log('    debugger            - Root-cause diagnosis (Pro)');
            console.log('    executor            - Focused execution (Pro)');
            console.log('    planner          - Strategic planning (Ultra)');
            console.log('    qa-tester           - Interactive CLI testing (Pro)');
            console.log(chalk.gray('  Tiered Variants (for smart routing):'));
            console.log('    architect-medium       - Simpler analysis (Pro)');
            console.log('    architect-low          - Quick questions (Flash)');
            console.log('    executor-high       - Complex tasks (Ultra)');
            console.log('    executor-low        - Trivial tasks (Flash)');
            console.log('    designer-high       - Design systems (Ultra)');
            console.log('    designer-low        - Simple styling (Flash)');
            console.log('');
            console.log(chalk.yellow('After Updates:'));
            console.log('  Run \'/omg-default\' (project) or \'/omg-default-global\' (global)');
            console.log('  to download the latest GEMINI.md configuration.');
            console.log('  This ensures you get the newest features and agent behaviors.');
            console.log('');
            console.log(chalk.blue('Quick Start:'));
            console.log('  1. Run \'gemini\' to start Gemini Code');
            console.log('  2. Type \'/omg-default\' for project or \'/omg-default-global\' for global');
            console.log('  3. Or use \'/omg <task>\' for one-time activation');
        }
    }
    else {
        console.error(chalk.red(`Installation failed: ${result.message}`));
        if (result.errors.length > 0) {
            result.errors.forEach(err => console.error(chalk.red(`  - ${err}`)));
        }
        console.error(chalk.gray('\nTry "omg install --force" to overwrite existing files.'));
        console.error(chalk.gray('For more diagnostics, run "omg doctor conflicts".'));
        process.exit(1);
    }
});
/**
 * Wait command - Rate limit wait and auto-resume
 *
 * Zero learning curve design:
 * - `omg wait` alone shows status and suggests next action
 * - `omg wait --start` starts the daemon (shortcut)
 * - `omg wait --stop` stops the daemon (shortcut)
 * - Subcommands available for power users
 */
const waitCmd = program
    .command('wait')
    .description('Rate limit wait and auto-resume (just run "omg wait" to get started)')
    .option('--json', 'Output as JSON')
    .option('--start', 'Start the auto-resume daemon')
    .option('--stop', 'Stop the auto-resume daemon')
    .addHelpText('after', `
Examples:
  $ omg wait                     Show status and suggestions
  $ omg wait --start             Start auto-resume daemon
  $ omg wait --stop              Stop auto-resume daemon
  $ omg wait status              Show detailed rate limit status
  $ omg wait detect              Scan for blocked tmux sessions`)
    .action(async (options) => {
    await waitCommand(options);
});
waitCmd
    .command('status')
    .description('Show detailed rate limit and daemon status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    await waitStatusCommand(options);
});
waitCmd
    .command('daemon <action>')
    .description('Start or stop the auto-resume daemon')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-f, --foreground', 'Run in foreground (blocking)')
    .option('-i, --interval <seconds>', 'Poll interval in seconds', '60')
    .addHelpText('after', `
Examples:
  $ omg wait daemon start            Start background daemon
  $ omg wait daemon stop             Stop the daemon
  $ omg wait daemon start -f         Run in foreground`)
    .action(async (action, options) => {
    if (action !== 'start' && action !== 'stop') {
        console.error(chalk.red(`Invalid action "${action}". Valid options: start, stop`));
        console.error(chalk.gray('Example: omg wait daemon start'));
        process.exit(1);
    }
    await waitDaemonCommand(action, {
        verbose: options.verbose,
        foreground: options.foreground,
        interval: parseInt(options.interval),
    });
});
waitCmd
    .command('detect')
    .description('Scan for blocked Gemini Code sessions in tmux')
    .option('--json', 'Output as JSON')
    .option('-l, --lines <number>', 'Number of pane lines to analyze', '15')
    .action(async (options) => {
    await waitDetectCommand({
        json: options.json,
        lines: parseInt(options.lines),
    });
});
/**
 * Teleport command - Quick worktree creation
 *
 * Usage:
 * - `omg teleport '#123'` - Create worktree for issue/PR #123
 * - `omg teleport my-feature` - Create worktree for feature branch
 * - `omg teleport list` - List existing worktrees
 * - `omg teleport remove <path>` - Remove a worktree
 */
const teleportCmd = program
    .command('teleport [ref]')
    .description("Create git worktree for isolated development (e.g., omg teleport '#123')")
    .option('--worktree', 'Create worktree (default behavior, flag kept for compatibility)')
    .option('-p, --path <path>', 'Custom worktree path (default: ~/Workspace/omg-worktrees/)')
    .option('-b, --base <branch>', 'Base branch to create from (default: main)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `
Examples:
  $ omg teleport '#42'           Create worktree for issue/PR #42
  $ omg teleport add-auth        Create worktree for a feature branch
  $ omg teleport list            List existing worktrees
  $ omg teleport remove ./path   Remove a worktree

Note:
  In many shells, # starts a comment. Quote refs: omg teleport '#42'`)
    .action(async (ref, options) => {
    if (!ref) {
        // No ref provided, show help
        console.log(chalk.blue('Teleport - Quick worktree creation\n'));
        console.log('Usage:');
        console.log('  omg teleport <ref>           Create worktree for issue/PR/feature');
        console.log('  omg teleport list            List existing worktrees');
        console.log('  omg teleport remove <path>   Remove a worktree');
        console.log('');
        console.log('Reference formats:');
        console.log("  '#123'                       Issue/PR in current repo (quoted for shell safety)");
        console.log('  owner/repo#123               Issue/PR in specific repo');
        console.log('  my-feature                   Feature branch name');
        console.log('  https://github.com/...       GitHub URL');
        console.log('');
        console.log(chalk.yellow("Note: In many shells, # starts a comment. Quote refs: omg teleport '#42'"));
        console.log('');
        console.log('Examples:');
        console.log("  omg teleport '#42'           Create worktree for issue #42");
        console.log('  omg teleport add-auth        Create worktree for feature "add-auth"');
        console.log('');
        return;
    }
    await teleportCommand(ref, {
        worktree: true, // Always create worktree
        worktreePath: options.path,
        base: options.base,
        json: options.json,
    });
});
teleportCmd
    .command('list')
    .description('List existing worktrees in ~/Workspace/omg-worktrees/')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    await teleportListCommand(options);
});
teleportCmd
    .command('remove <path>')
    .alias('rm')
    .description('Remove a worktree')
    .option('-f, --force', 'Force removal even with uncommitted changes')
    .option('--json', 'Output as JSON')
    .action(async (path, options) => {
    const exitCode = await teleportRemoveCommand(path, options);
    if (exitCode !== 0)
        process.exit(exitCode);
});
/**
 * Session command - Search prior local session history
 */
const sessionCmd = program
    .command('session')
    .alias('sessions')
    .description('Inspect prior local session history')
    .addHelpText('after', `
Examples:
  $ omg session search "team leader stale"
  $ omg session search notify-hook --since 7d
  $ omg session search provider-routing --project all --json`);
sessionCmd
    .command('search <query>')
    .description('Search prior local session transcripts and OMG session artifacts')
    .option('-l, --limit <number>', 'Maximum number of matches to return', '10')
    .option('-s, --session <id>', 'Restrict search to a specific session id')
    .option('--since <duration|date>', 'Only include matches since a duration (e.g. 7d, 24h) or absolute date')
    .option('--project <scope>', 'Project scope. Defaults to current project. Use "all" to search all local projects')
    .option('--json', 'Output results as JSON')
    .option('--case-sensitive', 'Match query case-sensitively')
    .option('--context <chars>', 'Approximate snippet context on each side of a match', '120')
    .action(async (query, options) => {
    await sessionSearchCommand(query, {
        limit: parseInt(options.limit, 10),
        session: options.session,
        since: options.since,
        project: options.project,
        json: options.json,
        caseSensitive: options.caseSensitive,
        context: parseInt(options.context, 10),
        workingDirectory: process.cwd(),
    });
});
/**
 * Doctor command - Diagnostic tools
 */
const doctorCmd = program
    .command('doctor')
    .description('Diagnostic tools for troubleshooting OMG installation')
    .addHelpText('after', `
Examples:
  $ omg doctor conflicts         Check for plugin conflicts`);
doctorCmd
    .command('conflicts')
    .description('Check for plugin coexistence issues and configuration conflicts')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `
Examples:
  $ omg doctor conflicts         Check for configuration issues
  $ omg doctor conflicts --json  Output results as JSON`)
    .action(async (options) => {
    const exitCode = await doctorConflictsCommand(options);
    process.exit(exitCode);
});
/**
 * Setup command - Official CLI entry point for omg-setup
 *
 * User-friendly command that syncs all OMG components:
 * - Installs/updates hooks, agents, and skills
 * - Reconciles runtime state after updates
 * - Shows clear summary of what was installed/updated
 */
program
    .command('setup')
    .description('Run OMG setup to sync all components (hooks, agents, skills)')
    .option('-f, --force', 'Force reinstall even if already up to date')
    .option('-q, --quiet', 'Suppress output except for errors')
    .option('--skip-hooks', 'Skip hook installation')
    .option('--force-hooks', 'Force reinstall hooks even if unchanged')
    .addHelpText('after', `
Examples:
  $ omg setup                     Sync all OMG components
  $ omg setup --force             Force reinstall everything
  $ omg setup --quiet             Silent setup for scripts
  $ omg setup --skip-hooks        Install without hooks
  $ omg setup --force-hooks       Force reinstall hooks`)
    .action(async (options) => {
    if (!options.quiet) {
        console.log(chalk.blue('Oh-My-GeminiCode Setup\n'));
    }
    // Step 1: Run installation (which handles hooks, agents, skills)
    if (!options.quiet) {
        console.log(chalk.gray('Syncing OMG components...'));
    }
    const result = installOmg({
        force: !!options.force,
        verbose: !options.quiet,
        skipGeminiCheck: true,
        forceHooks: !!options.forceHooks,
    });
    if (!result.success) {
        console.error(chalk.red(`Setup failed: ${result.message}`));
        if (result.errors.length > 0) {
            result.errors.forEach(err => console.error(chalk.red(`  - ${err}`)));
        }
        process.exit(1);
    }
    // Step 2: Show summary
    if (!options.quiet) {
        console.log('');
        console.log(chalk.green('Setup complete!'));
        console.log('');
        if (result.installedAgents.length > 0) {
            console.log(chalk.gray(`  Agents:   ${result.installedAgents.length} synced`));
        }
        if (result.installedCommands.length > 0) {
            console.log(chalk.gray(`  Commands: ${result.installedCommands.length} synced`));
        }
        if (result.installedSkills.length > 0) {
            console.log(chalk.gray(`  Skills:   ${result.installedSkills.length} synced`));
        }
        if (result.hooksConfigured) {
            console.log(chalk.gray('  Hooks:    configured'));
        }
        if (result.hookConflicts.length > 0) {
            console.log('');
            console.log(chalk.yellow('  Hook conflicts detected:'));
            result.hookConflicts.forEach(c => {
                console.log(chalk.yellow(`    - ${c.eventType}: ${c.existingCommand}`));
            });
        }
        const installed = getInstalledVersion();
        const reportedVersion = installed?.version ?? version;
        console.log('');
        console.log(chalk.gray(`Version: ${reportedVersion}`));
        if (reportedVersion !== version) {
            console.log(chalk.gray(`CLI package version: ${version}`));
        }
        console.log(chalk.gray('Start Gemini Code and use /oh-my-gemini:omg-setup for interactive setup.'));
    }
});
/**
 * Postinstall command - Silent install for npm postinstall hook
 */
program
    .command('postinstall', { hidden: true })
    .description('Run post-install setup (called automatically by npm)')
    .action(async () => {
    // Silent install - only show errors
    const result = installOmg({
        force: false,
        verbose: false,
        skipGeminiCheck: true
    });
    if (result.success) {
        console.log(chalk.green('✓ Oh-My-GeminiCode installed successfully!'));
        console.log(chalk.gray('  Run "oh-my-gemini info" to see available agents.'));
        console.log(chalk.yellow('  Run "/omg-default" (project) or "/omg-default-global" (global) in Gemini Code.'));
    }
    else {
        // Don't fail the npm install, just warn
        console.warn(chalk.yellow('⚠ Could not complete OMG setup:'), result.message);
        console.warn(chalk.gray('  Run "oh-my-gemini install" manually to complete setup.'));
    }
});
/**
 * HUD command - Run the OMG HUD statusline renderer
 * In --watch mode, loops continuously for use in a tmux pane.
 */
program
    .command('hud')
    .description('Run the OMG HUD statusline renderer')
    .option('--watch', 'Run in watch mode (continuous polling for tmux pane)')
    .option('--interval <ms>', 'Poll interval in milliseconds', '1000')
    .action(async (options) => {
    const { main: hudMain } = await import('../hud/index.js');
    if (options.watch) {
        const intervalMs = parseInt(options.interval, 10);
        await runHudWatchLoop({ intervalMs, hudMain });
    }
    else {
        await hudMain();
    }
});
program
    .command('mission-board')
    .description('Render the opt-in mission board snapshot for the current workspace')
    .option('--json', 'Print raw mission-board JSON')
    .action(async (options) => {
    const { refreshMissionBoardState, renderMissionBoard } = await import('../hud/mission-board.js');
    const state = refreshMissionBoardState(process.cwd());
    if (options.json) {
        console.log(JSON.stringify(state, null, 2));
        return;
    }
    const lines = renderMissionBoard(state, {
        enabled: true,
        maxMissions: 5,
        maxAgentsPerMission: 8,
        maxTimelineEvents: 8,
        persistCompletedForMinutes: 20,
    });
    console.log(lines.length > 0 ? lines.join('\n') : '(no active missions)');
});
/**
 * Team command - CLI API for team worker lifecycle operations
 * Exposes OMG's `omg team api` interface.
 *
 * helpOption(false) prevents commander from intercepting --help;
 * our teamCommand handler provides its own help output.
 */
program
    .command('team')
    .description('Team CLI API for worker lifecycle operations')
    .helpOption(false)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument('[args...]', 'team subcommand arguments')
    .action(async (args) => {
    await teamCommand(args);
});
/**
 * Autoresearch command - thin-supervisor autoresearch with keep/discard/reset parity
 */
program
    .command('autoresearch')
    .description('Launch thin-supervisor autoresearch with keep/discard/reset parity')
    .helpOption(false)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument('[args...]', 'autoresearch subcommand arguments')
    .action(async (args) => {
    await autoresearchCommand(args);
});
/**
 * Ralphthon command - Autonomous hackathon lifecycle
 *
 * Deep-interview generates PRD, ralph loop executes tasks,
 * auto-hardening phase, terminates after clean waves.
 */
program
    .command('ralphthon')
    .description('Autonomous hackathon lifecycle: interview -> execute -> harden -> done')
    .helpOption(false)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument('[args...]', 'ralphthon arguments')
    .action(async (args) => {
    await ralphthonCommand(args);
});
// Parse arguments
program.parse();
//# sourceMappingURL=index.js.map