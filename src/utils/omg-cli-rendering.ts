import { spawnSync } from 'child_process';

const OMG_CLI_BINARY = 'omg';
const OMG_PLUGIN_BRIDGE_PREFIX = 'node "$GEMINI_PLUGIN_ROOT"/bridge/cli.cjs';

export interface OmgCliRenderOptions {
  env?: NodeJS.ProcessEnv;
  omgAvailable?: boolean;
}

function commandExists(command: string, env: NodeJS.ProcessEnv): boolean {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookupCommand, [command], {
    stdio: 'ignore',
    env,
  });
  return result.status === 0;
}

export function resolveOmgCliPrefix(options: OmgCliRenderOptions = {}): string {
  const env = options.env ?? process.env;
  const omgAvailable = options.omgAvailable ?? commandExists(OMG_CLI_BINARY, env);
  if (omgAvailable) {
    return OMG_CLI_BINARY;
  }

  const pluginRoot = typeof env.GEMINI_PLUGIN_ROOT === 'string' ? env.GEMINI_PLUGIN_ROOT.trim() : '';
  if (pluginRoot) {
    return OMG_PLUGIN_BRIDGE_PREFIX;
  }

  return OMG_CLI_BINARY;
}

export function formatOmgCliInvocation(
  commandSuffix: string,
  options: OmgCliRenderOptions = {},
): string {
  const suffix = commandSuffix.trim().replace(/^omg\s+/, '');
  return `${resolveOmgCliPrefix(options)} ${suffix}`.trim();
}

export function rewriteOmgCliInvocations(
  text: string,
  options: OmgCliRenderOptions = {},
): string {
  const prefix = resolveOmgCliPrefix(options);
  if (prefix === OMG_CLI_BINARY || !text.includes('omg ')) {
    return text;
  }

  return text
    .replace(/`omg (?=[^`\r\n]+`)/g, `\`${prefix} `)
    .replace(/(^|\n)([ \t>*-]*)omg (?=\S)/g, `$1$2${prefix} `);
}
