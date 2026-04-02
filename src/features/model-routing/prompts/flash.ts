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
export const FLASH_PROMPT_PREFIX = `TASK: `;

/**
 * Flash prompt suffix - direct action
 */
export const FLASH_PROMPT_SUFFIX = `

Return results directly. No preamble.`;

/**
 * Adapt a base prompt for Flash execution
 */
export function adaptPromptForFlash(basePrompt: string): string {
  // For Flash, we want to strip unnecessary verbosity
  const condensed = condensePrompt(basePrompt);
  return FLASH_PROMPT_PREFIX + condensed + FLASH_PROMPT_SUFFIX;
}

/**
 * Condense a prompt for Flash - remove unnecessary words
 */
function condensePrompt(prompt: string): string {
  // Remove common filler phrases
  const condensed = prompt
    .replace(/please\s+/gi, '')
    .replace(/could you\s+/gi, '')
    .replace(/i would like you to\s+/gi, '')
    .replace(/i need you to\s+/gi, '')
    .replace(/can you\s+/gi, '')
    .replace(/would you\s+/gi, '')
    .replace(/i want you to\s+/gi, '')
    .replace(/make sure to\s+/gi, '')
    .replace(/be sure to\s+/gi, '')
    .replace(/don't forget to\s+/gi, '')
    .trim();

  return condensed;
}

/**
 * Flash search template
 */
export const FLASH_SEARCH_TEMPLATE = `SEARCH: {QUERY}

RETURN:
- File paths (absolute)
- Line numbers
- Brief context

FORMAT:
\`path/file.ts:123\` - [description]
`;

/**
 * Flash file listing template
 */
export const FLASH_LIST_TEMPLATE = `LIST: {TARGET}

RETURN: File paths matching criteria.
`;

/**
 * Flash documentation template
 */
export const FLASH_DOC_TEMPLATE = `DOCUMENT: {TARGET}

REQUIREMENTS:
{REQUIREMENTS}

OUTPUT: Markdown documentation.
`;

/**
 * Flash simple task template
 */
export const FLASH_SIMPLE_TEMPLATE = `DO: {TASK}

CONTEXT: {CONTEXT}

RETURN: {EXPECTED_OUTPUT}
`;

/**
 * Flash delegation template - ultra-concise
 */
export const FLASH_DELEGATION_TEMPLATE = `TASK: {TASK}
TARGET: {TARGET}
OUTPUT: {OUTPUT_FORMAT}
`;

/**
 * Extract key action from verbose prompt
 */
export function extractKeyAction(prompt: string): string {
  // Try to extract the main verb phrase
  const actionPatterns = [
    /(?:find|search|list|show|get|locate)\s+(.+?)(?:\.|$)/i,
    /(?:where|what)\s+(?:is|are)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of actionPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // If no pattern matches, return first sentence
  const firstSentence = prompt.split(/[.!?]/)[0];
  return firstSentence.trim();
}

/**
 * Create minimal exploration prompt
 */
export function createExplorePrompt(query: string): string {
  return `FIND: ${query}

TOOLS: Glob, Grep, Read

OUTPUT:
<files>
- /path/file.ts — [why relevant]
</files>

<answer>
[Direct answer]
</answer>`;
}

/**
 * Create minimal documentation prompt
 */
export function createDocPrompt(target: string, requirements: string[]): string {
  return `DOCUMENT: ${target}

INCLUDE:
${requirements.map(r => `- ${r}`).join('\n')}

FORMAT: Markdown
VERIFY: Code examples work`;
}
