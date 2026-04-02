import { describe, it, expect } from 'vitest';
import { VERSION, GEMINI_CONFIG_DIR, AGENTS_DIR, SKILLS_DIR, HOOKS_DIR, } from '../installer/index.js';
import { join } from 'path';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
/**
 * Get the package root directory for testing
 */
function getPackageDir() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, '..', '..');
}
/**
 * Load GEMINI.md content for testing
 */
function loadGeminiMdContent() {
    const geminiMdPath = join(getPackageDir(), 'docs', 'GEMINI.md');
    if (!existsSync(geminiMdPath)) {
        throw new Error(`GEMINI.md not found: ${geminiMdPath}`);
    }
    return readFileSync(geminiMdPath, 'utf-8');
}
describe('Installer v0.1.0 Standards', () => {
    const GEMINI_MD_CONTENT = loadGeminiMdContent();
    describe('Version Consistency', () => {
        it('should have a hardcoded VERSION', () => {
            expect(VERSION).toBe('0.1.0');
        });
        it('should have the correct version marker in docs/GEMINI.md', () => {
            const markerMatch = GEMINI_MD_CONTENT.match(/<!-- OMG:VERSION:([^\s]*?) -->/);
            expect(markerMatch?.[1]).toBe('0.1.0');
        });
    });
    describe('Terminology Normalization', () => {
        it('should use Flash/Pro/Ultra in GEMINI.md', () => {
            expect(GEMINI_MD_CONTENT).toContain('Flash');
            expect(GEMINI_MD_CONTENT).toContain('Pro');
            expect(GEMINI_MD_CONTENT).toContain('Ultra');
        });
        it('should contain the new Runtime Directives header', () => {
            expect(GEMINI_MD_CONTENT).toContain('# OMG Runtime Directives');
        });
    });
    describe('Project Structure', () => {
        it('should point to a valid GEMINI_CONFIG_DIR', () => {
            expect(GEMINI_CONFIG_DIR).toContain('.gemini');
        });
        it('should have normalized agent directory paths', () => {
            expect(AGENTS_DIR).toContain('agents');
            expect(SKILLS_DIR).toContain('skills');
            expect(HOOKS_DIR).toContain('hooks');
        });
    });
    describe('Agent Definitions', () => {
        it('should have core v0.1.0 agents available', () => {
            const agentsDir = join(getPackageDir(), 'agents');
            const files = readdirSync(agentsDir);
            const expectedAgents = ['architect.md', 'writer.md', 'verifier.md'];
            for (const agent of expectedAgents) {
                expect(files).toContain(agent);
                const content = readFileSync(join(agentsDir, agent), 'utf-8');
                expect(content).toContain('version: 0.1.0');
            }
        });
    });
});
//# sourceMappingURL=installer.test.js.map