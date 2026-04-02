export type ModelTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type ModelFamily = 'FLASH' | 'PRO' | 'ULTRA';
/**
 * Canonical Gemini family defaults.
 * Keep these date-less so version bumps are a one-line edit per family.
 */
export declare const GEMINI_FAMILY_DEFAULTS: Record<ModelFamily, string>;
/** Canonical tier->model mapping used as built-in defaults */
export declare const BUILTIN_TIER_MODEL_DEFAULTS: Record<ModelTier, string>;
/** Canonical Gemini high-reasoning variants by family */
export declare const GEMINI_FAMILY_HIGH_VARIANTS: Record<ModelFamily, string>;
/** Built-in defaults for external provider models */
export declare const BUILTIN_EXTERNAL_MODEL_DEFAULTS: {
    readonly geminiModelId: "gemini-pro";
};
export declare function hasTierModelEnvOverrides(): boolean;
export declare function getDefaultModelHigh(): string;
export declare function getDefaultModelMedium(): string;
export declare function getDefaultModelLow(): string;
/**
 * Get all default tier models as a record.
 */
export declare function getDefaultTierModels(): Record<ModelTier, string>;
/**
 * Resolve a Gemini family from an arbitrary model ID.
 */
export declare function resolveGeminiFamily(modelId: string): ModelFamily | null;
/**
 * Resolve a canonical Gemini high variant from a Gemini model ID.
 */
export declare function getGeminiHighVariantFromModel(modelId: string): string | null;
/** Get built-in default model for an external provider */
export declare function getBuiltinExternalDefaultModel(provider: 'gemini'): string;
/**
 * Vertex AI detection (Google's enterprise Gemini platform)
 */
export declare function isVertexAI(): boolean;
/**
 * Check whether OMG should avoid passing explicit model names.
 */
export declare function isNonGeminiProvider(): boolean;
//# sourceMappingURL=models.d.ts.map