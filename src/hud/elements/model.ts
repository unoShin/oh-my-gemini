/**
 * OMG HUD - Model Element
 *
 * Renders the current model name.
 */

import { cyan } from '../colors.js';
import { truncateToWidth } from '../../utils/string-width.js';
import type { ModelFormat } from '../types.js';

/**
 * Extract version from a model ID string.
 * E.g., 'gemini-1.5-pro' -> '1.5'
 *       'gemini-1.5-flash' -> '1.5'
 */
function extractVersion(modelId: string): string | null {
  // Match Gemini 1.5, 2.0, etc.
  const idMatch = modelId.match(/gemini-(\d+(?:\.\d+)?)/i);
  if (idMatch) return idMatch[1];

  return null;
}

/**
 * Format model name for display.
 * Converts model IDs to friendly names based on the requested format.
 */
export function formatModelName(modelId: string | null | undefined, format: ModelFormat = 'short'): string | null {
  if (!modelId) return null;

  if (format === 'full') {
    return truncateToWidth(modelId, 40);
  }

  const id = modelId.toLowerCase();
  let shortName: string | null = null;

  if (id.includes('ultra')) shortName = 'Ultra';
  else if (id.includes('pro')) shortName = 'Pro';
  else if (id.includes('flash')) shortName = 'Flash';

  if (!shortName) {
    // Return original if not recognized (CJK-aware truncation)
    return truncateToWidth(modelId, 20);
  }

  if (format === 'versioned') {
    const version = extractVersion(id);
    if (version) return `${shortName} ${version}`;
  }

  return shortName;
}

/**
 * Render model element.
 */
export function renderModel(modelId: string | null | undefined, format: ModelFormat = 'short'): string | null {
  const name = formatModelName(modelId, format);
  if (!name) return null;
  return cyan(name);
}
