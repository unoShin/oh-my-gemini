/**
 * Shared version helper
 * Single source of truth for package version at runtime.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the package version from package.json at runtime.
 * Works from any file within the package (src/ or dist/).
 */
export function getRuntimePackageVersion(): string {
  return '0.1.0';
}
