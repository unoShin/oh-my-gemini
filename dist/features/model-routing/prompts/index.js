/**
 * Tiered Prompt Adaptations
 *
 * Provides model-specific prompt adaptations for Ultra, Pro, and Flash.
 * Each tier has prompts optimized for that model's capabilities.
 */
import { TIER_PROMPT_STRATEGIES } from '../types.js';
import { adaptPromptForUltra, ULTRA_PROMPT_PREFIX, ULTRA_PROMPT_SUFFIX } from './ultra.js';
import { adaptPromptForPro, PRO_PROMPT_PREFIX, PRO_PROMPT_SUFFIX } from './pro.js';
import { adaptPromptForFlash, FLASH_PROMPT_PREFIX, FLASH_PROMPT_SUFFIX } from './flash.js';
// Re-export tier-specific modules
export * from './ultra.js';
export * from './pro.js';
export * from './flash.js';
/**
 * Adapt a prompt for a specific complexity tier
 */
export function adaptPromptForTier(prompt, tier) {
    switch (tier) {
        case 'HIGH':
            return adaptPromptForUltra(prompt);
        case 'MEDIUM':
            return adaptPromptForPro(prompt);
        case 'LOW':
            return adaptPromptForFlash(prompt);
    }
}
/**
 * Get the prompt strategy for a tier
 */
export function getPromptStrategy(tier) {
    return TIER_PROMPT_STRATEGIES[tier];
}
/**
 * Get prompt prefix for a tier
 */
export function getPromptPrefix(tier) {
    switch (tier) {
        case 'HIGH':
            return ULTRA_PROMPT_PREFIX;
        case 'MEDIUM':
            return PRO_PROMPT_PREFIX;
        case 'LOW':
            return FLASH_PROMPT_PREFIX;
    }
}
/**
 * Get prompt suffix for a tier
 */
export function getPromptSuffix(tier) {
    switch (tier) {
        case 'HIGH':
            return ULTRA_PROMPT_SUFFIX;
        case 'MEDIUM':
            return PRO_PROMPT_SUFFIX;
        case 'LOW':
            return FLASH_PROMPT_SUFFIX;
    }
}
/**
 * Create a delegation prompt with tier-appropriate framing
 */
export function createDelegationPrompt(tier, task, context) {
    const prefix = getPromptPrefix(tier);
    const suffix = getPromptSuffix(tier);
    let body = `### Task\n${task}\n`;
    if (context.deliverables) {
        body += `\n### Deliverables\n${context.deliverables}\n`;
    }
    if (context.successCriteria) {
        body += `\n### Success Criteria\n${context.successCriteria}\n`;
    }
    if (context.context) {
        body += `\n### Context\n${context.context}\n`;
    }
    if (context.mustDo?.length) {
        body += `\n### MUST DO\n${context.mustDo.map(m => `- ${m}`).join('\n')}\n`;
    }
    if (context.mustNotDo?.length) {
        body += `\n### MUST NOT DO\n${context.mustNotDo.map(m => `- ${m}`).join('\n')}\n`;
    }
    if (context.requiredSkills?.length) {
        body += `\n### REQUIRED SKILLS\n${context.requiredSkills.map(s => `- ${s}`).join('\n')}\n`;
    }
    if (context.requiredTools?.length) {
        body += `\n### REQUIRED TOOLS\n${context.requiredTools.map(t => `- ${t}`).join('\n')}\n`;
    }
    return prefix + body + suffix;
}
/**
 * Tier-specific instructions for common task types
 */
export const TIER_TASK_INSTRUCTIONS = {
    HIGH: {
        search: 'Perform thorough multi-angle search with analysis of findings.',
        implement: 'Design solution with tradeoff analysis before implementing.',
        debug: 'Deep root cause analysis with hypothesis testing.',
        review: 'Comprehensive evaluation against multiple criteria.',
        plan: 'Strategic planning with risk analysis and alternatives.',
    },
    MEDIUM: {
        search: 'Search efficiently, return structured results.',
        implement: 'Follow existing patterns, implement cleanly.',
        debug: 'Systematic debugging, fix the issue.',
        review: 'Check against criteria, provide feedback.',
        plan: 'Create actionable plan with clear steps.',
    },
    LOW: {
        search: 'Find and return paths.',
        implement: 'Make the change.',
        debug: 'Fix the bug.',
        review: 'Check it.',
        plan: 'List steps.',
    },
};
/**
 * Get task-specific instructions for a tier
 */
export function getTaskInstructions(tier, taskType) {
    return TIER_TASK_INSTRUCTIONS[tier][taskType] ?? TIER_TASK_INSTRUCTIONS[tier].implement;
}
//# sourceMappingURL=index.js.map