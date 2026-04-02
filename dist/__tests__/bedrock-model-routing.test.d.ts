/**
 * Repro test for Bedrock model routing bug
 *
 * Bug: On Bedrock, workers get model ID "gemini-sonnet-4-6" (bare builtin default)
 * instead of inheriting the parent model. On Bedrock, this bare ID is invalid
 * — Bedrock requires full IDs like "us.anthropic.gemini-sonnet-4-6-v1:0".
 *
 * Root cause chain:
 * 1. buildDefaultConfig() → config.agents.executor.model = 'gemini-sonnet-4-6'
 *    (from GEMINI_FAMILY_DEFAULTS.SONNET, because no Bedrock env vars found)
 * 2. getAgentDefinitions() resolves executor.model = 'gemini-sonnet-4-6'
 *    (configuredModel from config takes precedence over agent's defaultModel)
 * 3. enforceModel() injects 'gemini-sonnet-4-6' into Task calls
 * 4. Gemini Code passes it to Bedrock API → 400 invalid model
 *
 * The defense (forceInherit) works IF GEMINI_CODE_USE_BEDROCK=1 is in the env.
 * But if that env var doesn't propagate to the MCP server / hook process,
 * forceInherit is never auto-enabled, and bare model IDs leak through.
 */
export {};
//# sourceMappingURL=bedrock-model-routing.test.d.ts.map