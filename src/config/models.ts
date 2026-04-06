import { validateGeminiBaseUrl } from '../utils/ssrf-guard.js';

export type ModelTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type ModelFamily = 'FLASH' | 'PRO' | 'ULTRA';

const TIER_ENV_KEYS: Record<ModelTier, readonly string[]> = {
  LOW: [
    'OMG_MODEL_LOW',
    'GEMINI_CODE_FLASH_MODEL',
    'GOOGLE_DEFAULT_FLASH_MODEL',
  ],
  MEDIUM: [
    'OMG_MODEL_MEDIUM',
    'GEMINI_CODE_PRO_MODEL',
    'GOOGLE_DEFAULT_PRO_MODEL',
  ],
  HIGH: [
    'OMG_MODEL_HIGH',
    'GEMINI_CODE_ULTRA_MODEL',
    'GOOGLE_DEFAULT_ULTRA_MODEL',
  ],
};

/**
 * Canonical Gemini family defaults.
 * Keep these date-less so version bumps are a one-line edit per family.
 */
export const GEMINI_FAMILY_DEFAULTS: Record<ModelFamily, string> = {
  FLASH: 'gemini-3-flash-preview',
  PRO: 'gemini-3-flash-preview',
  ULTRA: 'gemini-3-flash-preview', // Currently the highest public reasoning model
};

/** Canonical tier->model mapping used as built-in defaults */
export const BUILTIN_TIER_MODEL_DEFAULTS: Record<ModelTier, string> = {
  LOW: GEMINI_FAMILY_DEFAULTS.FLASH,
  MEDIUM: GEMINI_FAMILY_DEFAULTS.PRO,
  HIGH: GEMINI_FAMILY_DEFAULTS.ULTRA,
};

/** Canonical Gemini high-reasoning variants by family */
export const GEMINI_FAMILY_HIGH_VARIANTS: Record<ModelFamily, string> = {
  FLASH: `${GEMINI_FAMILY_DEFAULTS.FLASH}-thinking-exp`,
  PRO: `${GEMINI_FAMILY_DEFAULTS.PRO}-high`,
  ULTRA: `${GEMINI_FAMILY_DEFAULTS.ULTRA}-high`,
};

/** Built-in defaults for external provider models */
export const BUILTIN_EXTERNAL_MODEL_DEFAULTS = {
  geminiModelId: 'gemini-pro',
} as const;

/**
 * Centralized Model ID Constants
 *
 * All default model IDs are defined here so they can be overridden
 * via environment variables without editing source code.
 */

/**
 * Resolve the default model ID for a tier from environment variables.
 */
function resolveTierModelFromEnv(tier: ModelTier): string | undefined {
  for (const key of TIER_ENV_KEYS[tier]) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function hasTierModelEnvOverrides(): boolean {
  return Object.values(TIER_ENV_KEYS).some((keys) =>
    keys.some((key) => {
      const value = process.env[key]?.trim();
      return Boolean(value);
    })
  );
}

export function getDefaultModelHigh(): string {
  return resolveTierModelFromEnv('HIGH') || BUILTIN_TIER_MODEL_DEFAULTS.HIGH;
}

export function getDefaultModelMedium(): string {
  return resolveTierModelFromEnv('MEDIUM') || BUILTIN_TIER_MODEL_DEFAULTS.MEDIUM;
}

export function getDefaultModelLow(): string {
  return resolveTierModelFromEnv('LOW') || BUILTIN_TIER_MODEL_DEFAULTS.LOW;
}

/**
 * Get all default tier models as a record.
 */
export function getDefaultTierModels(): Record<ModelTier, string> {
  return {
    LOW: getDefaultModelLow(),
    MEDIUM: getDefaultModelMedium(),
    HIGH: getDefaultModelHigh(),
  };
}

/**
 * Resolve a Gemini family from an arbitrary model ID.
 */
export function resolveGeminiFamily(modelId: string): ModelFamily | null {
  const lower = modelId.toLowerCase();
  
  if (lower.includes('pro')) return 'PRO';
  if (lower.includes('ultra')) return 'ULTRA';
  if (lower.includes('flash')) return 'FLASH';

  return null;
}

/**
 * Resolve a canonical Gemini high variant from a Gemini model ID.
 */
export function getGeminiHighVariantFromModel(modelId: string): string | null {
  const family = resolveGeminiFamily(modelId);
  return family ? GEMINI_FAMILY_HIGH_VARIANTS[family] : null;
}

/** Get built-in default model for an external provider */
export function getBuiltinExternalDefaultModel(_provider: 'gemini'): string {
  return BUILTIN_EXTERNAL_MODEL_DEFAULTS.geminiModelId;
}

/**
 * Vertex AI detection (Google's enterprise Gemini platform)
 */
export function isVertexAI(): boolean {
  if (process.env.GEMINI_CODE_USE_VERTEX === '1') {
    return true;
  }

  const modelId = process.env.ANTHROPIC_MODEL || process.env.GOOGLE_MODEL || '';
  if (modelId && modelId.toLowerCase().startsWith('vertex_ai/')) {
    return true;
  }

  return false;
}

/**
 * Check whether OMG should avoid passing explicit model names.
 */
export function isNonGeminiProvider(): boolean {
  if (process.env.OMG_ROUTING_FORCE_INHERIT === 'true') {
    return true;
  }

  if (isVertexAI()) {
    return true;
  }

  const modelId = (process.env.ANTHROPIC_MODEL || process.env.GOOGLE_MODEL || '').toLowerCase();
  
  // Explicit Bedrock/Vertex patterns
  if (modelId.includes('us.anthropic.') || modelId.includes('vertex_ai/')) {
    return true;
  }

  // If it's not a native alias and doesn't contain 'gemini', it's external
  if (modelId && !modelId.includes('gemini')) {
    return true;
  }

  // Check for custom base URLs that might point to proxies
  const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
  if (baseUrl) {
    const validation = validateGeminiBaseUrl(baseUrl);
    if (!validation.allowed) {
      console.error(`[SSRF Guard] Rejecting ANTHROPIC_BASE_URL: ${validation.reason}`);
      return true;
    }
    if (!baseUrl.includes('google.com') && !baseUrl.includes('googleapis.com')) {
      return true;
    }
  }

  return false;
}
