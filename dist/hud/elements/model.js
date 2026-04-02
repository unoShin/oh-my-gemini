/**
 * OMG HUD - Model Element
 *
 * Renders the current model name.
 */
import { cyan } from '../colors.js';
import { truncateToWidth } from '../../utils/string-width.js';
/**
 * Extract version from a model ID string.
 * E.g., 'gemini-ultra-4-6-20260205' -> '4.6'
 *       'gemini-pro-4-6-20260217' -> '4.6'
 *       'gemini-flash-4-5-20251001' -> '4.5'
 */
function extractVersion(modelId) {
    // Match hyphenated ID patterns like ultra-4-6, pro-4-5, flash-4-5
    const idMatch = modelId.match(/(?:ultra|pro|flash)-(\d+)-(\d+)/i);
    if (idMatch)
        return `${idMatch[1]}.${idMatch[2]}`;
    // Match display name patterns like "Pro 4.5", "Ultra 4.6"
    const displayMatch = modelId.match(/(?:ultra|pro|flash)\s+(\d+(?:\.\d+)?)/i);
    if (displayMatch)
        return displayMatch[1];
    return null;
}
/**
 * Format model name for display.
 * Converts model IDs to friendly names based on the requested format.
 */
export function formatModelName(modelId, format = 'short') {
    if (!modelId)
        return null;
    if (format === 'full') {
        return truncateToWidth(modelId, 40);
    }
    const id = modelId.toLowerCase();
    let shortName = null;
    if (id.includes('ultra'))
        shortName = 'Ultra';
    else if (id.includes('pro'))
        shortName = 'Pro';
    else if (id.includes('flash'))
        shortName = 'Flash';
    if (!shortName) {
        // Return original if not recognized (CJK-aware truncation)
        return truncateToWidth(modelId, 20);
    }
    if (format === 'versioned') {
        const version = extractVersion(id);
        if (version)
            return `${shortName} ${version}`;
    }
    return shortName;
}
/**
 * Render model element.
 */
export function renderModel(modelId, format = 'short') {
    const name = formatModelName(modelId, format);
    if (!name)
        return null;
    return cyan(name);
}
//# sourceMappingURL=model.js.map