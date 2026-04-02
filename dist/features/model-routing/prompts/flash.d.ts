/**
 * Flash-Optimized Prompt Adaptations
 *
 * Flash (LOW tier) prompts are designed for:
 * - Maximum speed and efficiency
 * - Concise, direct instructions
 * - Simple, focused tasks
 * - Minimal cognitive overhead
 */
/**
 * Flash prompt prefix - minimal overhead
 */
export declare const FLASH_PROMPT_PREFIX = "TASK: ";
/**
 * Flash prompt suffix - direct action
 */
export declare const FLASH_PROMPT_SUFFIX = "\n\nReturn results directly. No preamble.";
/**
 * Adapt a base prompt for Flash execution
 */
export declare function adaptPromptForFlash(basePrompt: string): string;
/**
 * Flash search template
 */
export declare const FLASH_SEARCH_TEMPLATE = "SEARCH: {QUERY}\n\nRETURN:\n- File paths (absolute)\n- Line numbers\n- Brief context\n\nFORMAT:\n`path/file.ts:123` - [description]\n";
/**
 * Flash file listing template
 */
export declare const FLASH_LIST_TEMPLATE = "LIST: {TARGET}\n\nRETURN: File paths matching criteria.\n";
/**
 * Flash documentation template
 */
export declare const FLASH_DOC_TEMPLATE = "DOCUMENT: {TARGET}\n\nREQUIREMENTS:\n{REQUIREMENTS}\n\nOUTPUT: Markdown documentation.\n";
/**
 * Flash simple task template
 */
export declare const FLASH_SIMPLE_TEMPLATE = "DO: {TASK}\n\nCONTEXT: {CONTEXT}\n\nRETURN: {EXPECTED_OUTPUT}\n";
/**
 * Flash delegation template - ultra-concise
 */
export declare const FLASH_DELEGATION_TEMPLATE = "TASK: {TASK}\nTARGET: {TARGET}\nOUTPUT: {OUTPUT_FORMAT}\n";
/**
 * Extract key action from verbose prompt
 */
export declare function extractKeyAction(prompt: string): string;
/**
 * Create minimal exploration prompt
 */
export declare function createExplorePrompt(query: string): string;
/**
 * Create minimal documentation prompt
 */
export declare function createDocPrompt(target: string, requirements: string[]): string;
//# sourceMappingURL=flash.d.ts.map