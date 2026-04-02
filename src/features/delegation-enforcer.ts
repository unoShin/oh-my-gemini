/**
 * Delegation Enforcer
 *
 * Middleware that ensures model parameter is always present in Task/Agent calls.
 * Automatically injects the default model from agent definitions when not specified.
 *
 * This solves the problem where Gemini Code doesn't automatically apply models
 * from agent definitions - every Task call must explicitly pass the model parameter.
 *
 * For non-Gemini providers (CC Switch, LiteLLM, etc.), forceInherit is auto-enabled
 * by the config loader (issue #1201), which causes this enforcer to strip model
 * parameters so agents inherit the user's configured model instead of receiving
 * Gemini-specific tier names (pro/ultra/flash) that the provider won't recognize.
 */

import { getAgentDefinitions } from '../agents/definitions.js';
import { normalizeDelegationRole } from './delegation-routing/types.js';
import { loadConfig } from '../config/loader.js';
import { resolveGeminiFamily } from '../config/models.js';
import type { PluginConfig } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Config cache — avoids repeated disk reads on every enforceModel() call (F10)
//
// The cache key is built from every env var that loadConfig() reads.
// When any env var changes (as tests do between cases), the key changes and
// loadConfig() is called fresh. The mock in routing-force-inherit.test.ts
// replaces the loadConfig import binding, so vi.fn() return values flow
// through here automatically — no extra wiring needed.
// ---------------------------------------------------------------------------

/** All env var names that affect the output of loadConfig(). */
const CONFIG_ENV_KEYS = [
  // forceInherit auto-detection (isNonGeminiProvider)
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_MODEL',
  'GEMINI_CODE_USE_BEDROCK',
  'GEMINI_CODE_USE_VERTEX',
  // explicit routing overrides
  'OMG_ROUTING_FORCE_INHERIT',
  'OMG_ROUTING_ENABLED',
  'OMG_ROUTING_DEFAULT_TIER',
  'OMG_ESCALATION_ENABLED',
  // model alias overrides (issue #1211)
  'OMG_MODEL_ALIAS_FLASH',
  'OMG_MODEL_ALIAS_PRO',
  'OMG_MODEL_ALIAS_ULTRA',
  // tier model resolution (feeds buildDefaultConfig)
  'OMG_MODEL_HIGH',
  'OMG_MODEL_MEDIUM',
  'OMG_MODEL_LOW',
  'GEMINI_CODE_BEDROCK_FLASH_MODEL',
  'GEMINI_CODE_BEDROCK_PRO_MODEL',
  'GEMINI_CODE_BEDROCK_ULTRA_MODEL',
  'ANTHROPIC_DEFAULT_FLASH_MODEL',
  'ANTHROPIC_DEFAULT_PRO_MODEL',
  'ANTHROPIC_DEFAULT_ULTRA_MODEL',
] as const;

function buildEnvCacheKey(): string {
  return CONFIG_ENV_KEYS.map((k) => `${k}=${process.env[k] ?? ''}`).join('|');
}

let _cachedConfig: PluginConfig | null = null;
let _cachedConfigKey = '';

function getCachedConfig(): PluginConfig {
  // In test environments, skip the cache so vi.mock/vi.fn() overrides of
  // loadConfig are always respected without needing to invalidate the cache.
  if (process.env.VITEST) {
    return loadConfig();
  }
  const key = buildEnvCacheKey();
  if (_cachedConfig === null || key !== _cachedConfigKey) {
    _cachedConfig = loadConfig();
    _cachedConfigKey = key;
  }
  return _cachedConfig;
}


/** Map Gemini model family to CC-supported alias */
const FAMILY_TO_ALIAS: Record<string, string> = {
  PRO: 'pro',
  ULTRA: 'ultra',
  FLASH: 'flash',
};

/** Normalize a model ID to a CC-supported alias (pro/ultra/flash) if possible */
export function normalizeToCcAlias(model: string): string {
  const family = resolveGeminiFamily(model);
  return family ? (FAMILY_TO_ALIAS[family] ?? model) : model;
}

/**
 * Agent input structure from Gemini Agent SDK
 */
export interface AgentInput {
  description: string;
  prompt: string;
  subagent_type: string;
  model?: string;
  resume?: string;
  run_in_background?: boolean;
}

/**
 * Result of model enforcement
 */
export interface EnforcementResult {
  /** Original input */
  originalInput: AgentInput;
  /** Modified input with model enforced */
  modifiedInput: AgentInput;
  /** Whether model was auto-injected */
  injected: boolean;
  /** The model that was used */
  model: string;
  /** Warning message (only if OMG_DEBUG=true) */
  warning?: string;
}

function isDelegationToolName(toolName: string): boolean {
  const normalizedToolName = toolName.toLowerCase();
  return normalizedToolName === 'agent' || normalizedToolName === 'task';
}

function canonicalizeSubagentType(subagentType: string): string {
  const hasPrefix = subagentType.startsWith('oh-my-gemini:');
  const rawAgentType = subagentType.replace(/^oh-my-gemini:/, '');
  const canonicalAgentType = normalizeDelegationRole(rawAgentType);
  return hasPrefix ? `oh-my-gemini:${canonicalAgentType}` : canonicalAgentType;
}

/**
 * Enforce model parameter for an agent delegation call
 *
 * If model is explicitly specified, it's preserved.
 * If not, the default model from agent definition is injected.
 *
 * @param agentInput - The agent/task input parameters
 * @returns Enforcement result with modified input
 * @throws Error if agent type has no default model
 */
export function enforceModel(agentInput: AgentInput): EnforcementResult {
  const canonicalSubagentType = canonicalizeSubagentType(agentInput.subagent_type);

  // If forceInherit is enabled, skip model injection entirely so agents
  // inherit the user's Gemini Code model setting (issue #1135)
  const config = getCachedConfig();
  if (config.routing?.forceInherit) {
    const { model: _existing, ...rest } = agentInput;
    const cleanedInput: AgentInput = { ...(rest as AgentInput), subagent_type: canonicalSubagentType };
    return {
      originalInput: agentInput,
      modifiedInput: cleanedInput,
      injected: false,
      model: 'inherit',
    };
  }

  // If model is already specified, normalize it to CC-supported aliases
  // before passing through. Full IDs like 'gemini-pro-4-6' cause 400
  // errors on Bedrock/Vertex. (issue #1415)
  if (agentInput.model) {
    const normalizedModel = normalizeToCcAlias(agentInput.model);
    return {
      originalInput: agentInput,
      modifiedInput: { ...agentInput, subagent_type: canonicalSubagentType, model: normalizedModel },
      injected: false,
      model: normalizedModel,
    };
  }

  const agentType = canonicalSubagentType.replace(/^oh-my-gemini:/, '');
  const agentDefs = getAgentDefinitions({ config });
  const agentDef = agentDefs[agentType];

  if (!agentDef) {
    throw new Error(`Unknown agent type: ${agentType} (from ${agentInput.subagent_type})`);
  }

  if (!agentDef.model) {
    throw new Error(`No default model defined for agent: ${agentType}`);
  }

  // Apply modelAliases from config (issue #1211).
  // Priority: explicit param (already handled above) > modelAliases > agent default.
  // This lets users remap tier names without the nuclear forceInherit option.
  let resolvedModel = agentDef.model;
  const aliases = config.routing?.modelAliases;
  const aliasSourceModel = agentDef.defaultModel ?? agentDef.model;
  if (aliases && aliasSourceModel && aliasSourceModel !== 'inherit') {
    const alias = aliases[aliasSourceModel as keyof typeof aliases];
    if (alias) {
      resolvedModel = alias;
    }
  }

  // If the resolved model is 'inherit', don't inject any model parameter.
  if (resolvedModel === 'inherit') {
    const { model: _existing, ...rest } = agentInput;
    const cleanedInput: AgentInput = { ...(rest as AgentInput), subagent_type: canonicalSubagentType };
    return {
      originalInput: agentInput,
      modifiedInput: cleanedInput,
      injected: false,
      model: 'inherit',
    };
  }

  // Normalize model to Gemini Code's supported aliases (pro/ultra/flash).
  // Full IDs cause 400 errors on Bedrock/Vertex. (issue #1201, #1415)
  const normalizedModel = normalizeToCcAlias(resolvedModel);

  const modifiedInput: AgentInput = {
    ...agentInput,
    subagent_type: canonicalSubagentType,
    model: normalizedModel,
  };

  let warning: string | undefined;
  if (process.env.OMG_DEBUG === 'true') {
    const aliasNote = resolvedModel !== agentDef.model && aliasSourceModel
      ? ` (aliased from ${aliasSourceModel})`
      : '';
    const normalizedNote = normalizedModel !== resolvedModel
      ? ` (normalized from ${resolvedModel})`
      : '';
    warning = `[OMG] Auto-injecting model: ${normalizedModel} for ${agentType}${aliasNote}${normalizedNote}`;
  }

  return {
    originalInput: agentInput,
    modifiedInput,
    injected: true,
    model: normalizedModel,
    warning,
  };
}

/**
 * Check if tool input is an agent delegation call
 */
export function isAgentCall(toolName: string, toolInput: unknown): toolInput is AgentInput {
  if (!isDelegationToolName(toolName)) {
    return false;
  }

  if (!toolInput || typeof toolInput !== 'object') {
    return false;
  }

  const input = toolInput as Record<string, unknown>;
  return (
    typeof input.subagent_type === 'string' &&
    typeof input.prompt === 'string' &&
    typeof input.description === 'string'
  );
}

/**
 * Process a pre-tool-use hook for model enforcement
 */
export function processPreToolUse(
  toolName: string,
  toolInput: unknown
): { modifiedInput: unknown; warning?: string } {
  if (!isAgentCall(toolName, toolInput)) {
    return { modifiedInput: toolInput };
  }

  const result = enforceModel(toolInput);

  if (result.warning) {
    console.warn(result.warning);
  }

  return {
    modifiedInput: result.modifiedInput,
    warning: result.warning,
  };
}

/**
 * Get model for an agent type (for testing/debugging)
 */
export function getModelForAgent(agentType: string): string {
  const normalizedType = normalizeDelegationRole(agentType.replace(/^oh-my-gemini:/, ''));
  const agentDefs = getAgentDefinitions({ config: getCachedConfig() });
  const agentDef = agentDefs[normalizedType];

  if (!agentDef) {
    throw new Error(`Unknown agent type: ${normalizedType}`);
  }

  if (!agentDef.model) {
    throw new Error(`No default model defined for agent: ${normalizedType}`);
  }

  // Normalize to CC-supported aliases (pro/ultra/flash)
  return normalizeToCcAlias(agentDef.model);
}
