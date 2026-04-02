/**
 * Agent Types for Oh-My-GeminiCode
 *
 * Defines types for agent configuration and metadata used in dynamic prompt generation.
 * Ported from oh-my-opencode's agent type system.
 */
/**
 * Check if a model ID is a GPT model
 */
export function isGptModel(modelId) {
    return modelId.toLowerCase().includes('gpt');
}
/**
 * Check if a model ID is a Gemini model
 */
export function isGeminiModel(modelId) {
    return modelId.toLowerCase().includes('gemini');
}
/**
 * Get default model for a category
 */
export function getDefaultModelForCategory(category) {
    switch (category) {
        case 'exploration':
            return 'flash'; // Fast, cheap
        case 'specialist':
            return 'pro'; // Balanced
        case 'advisor':
            return 'ultra'; // High quality reasoning
        case 'utility':
            return 'flash'; // Fast, cheap
        case 'orchestration':
            return 'pro'; // Balanced
        default:
            return 'pro';
    }
}
//# sourceMappingURL=types.js.map