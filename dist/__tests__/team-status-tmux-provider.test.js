import { describe, it, expect } from "vitest";
// ============================================================================
// BUG 6: team-status provider type handles tmux workers
// ============================================================================
describe('BUG 6: team-status provider type for tmux workers', () => {
    it('source strips both mcp- and tmux- prefixes', async () => {
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const source = readFileSync(join(process.cwd(), 'src/team/team-status.ts'), 'utf-8');
        // Should use a regex that strips both prefixes
        expect(source).toMatch(/replace\(.*mcp.*tmux/s);
        // Should include 'gemini' in the provider union type
        expect(source).toContain("'gemini'");
    });
    it('WorkerStatus interface includes gemini in provider union', async () => {
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const source = readFileSync(join(process.cwd(), 'src/team/team-status.ts'), 'utf-8');
        // The interface should have gemini in the union
        const interfaceMatch = source.match(/interface WorkerStatus[\s\S]*?provider:\s*([^;]+);/);
        expect(interfaceMatch).not.toBeNull();
        expect(interfaceMatch[1]).toContain("'gemini'");
        expect(interfaceMatch[1]).toContain("'gemini'");
        expect(interfaceMatch[1]).toContain("'gemini'");
    });
    it('regex correctly strips mcp- prefix', () => {
        const regex = /^(?:mcp|tmux)-/;
        expect('mcp-gemini'.replace(regex, '')).toBe('gemini');
    });
    it('regex correctly strips tmux- prefix', () => {
        const regex = /^(?:mcp|tmux)-/;
        expect('tmux-gemini'.replace(regex, '')).toBe('gemini');
    });
    it('regex correctly strips tmux-gemini to gemini', () => {
        const regex = /^(?:mcp|tmux)-/;
        expect('tmux-gemini'.replace(regex, '')).toBe('gemini');
    });
});
//# sourceMappingURL=team-status-tmux-provider.test.js.map