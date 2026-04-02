import { describe, it, expect } from 'vitest';
import { omgToolsServer, omgToolNames, getOmgToolNames } from '../mcp/omg-tools-server.js';
const interopEnabled = process.env.OMG_INTEROP_TOOLS_ENABLED === '1';
const totalTools = interopEnabled ? 50 : 42;
const withoutLsp = interopEnabled ? 38 : 30;
const withoutAst = interopEnabled ? 48 : 40;
const withoutPython = interopEnabled ? 49 : 41;
const withoutSkills = interopEnabled ? 47 : 39;
describe('omg-tools-server', () => {
    describe('omgToolNames', () => {
        it('should export expected tools total', () => {
            expect(omgToolNames).toHaveLength(totalTools);
        });
        it('should have 12 LSP tools', () => {
            const lspTools = omgToolNames.filter(n => n.includes('lsp_'));
            expect(lspTools).toHaveLength(12);
        });
        it('should have 2 AST tools', () => {
            const astTools = omgToolNames.filter(n => n.includes('ast_'));
            expect(astTools).toHaveLength(2);
        });
        it('should have python_repl tool', () => {
            expect(omgToolNames).toContain('mcp__t__python_repl');
        });
        it('should have session_search tool', () => {
            expect(omgToolNames).toContain('mcp__t__session_search');
        });
        it('should use correct MCP naming format', () => {
            omgToolNames.forEach(name => {
                expect(name).toMatch(/^mcp__t__/);
            });
        });
    });
    describe('getOmgToolNames', () => {
        it('should return all tools by default', () => {
            const tools = getOmgToolNames();
            expect(tools).toHaveLength(totalTools);
        });
        it('should filter out LSP tools when includeLsp is false', () => {
            const tools = getOmgToolNames({ includeLsp: false });
            expect(tools.some(t => t.includes('lsp_'))).toBe(false);
            expect(tools).toHaveLength(withoutLsp);
        });
        it('should filter out AST tools when includeAst is false', () => {
            const tools = getOmgToolNames({ includeAst: false });
            expect(tools.some(t => t.includes('ast_'))).toBe(false);
            expect(tools).toHaveLength(withoutAst);
        });
        it('should filter out python_repl when includePython is false', () => {
            const tools = getOmgToolNames({ includePython: false });
            expect(tools.some(t => t.includes('python_repl'))).toBe(false);
            expect(tools).toHaveLength(withoutPython);
        });
        it('should filter out skills tools', () => {
            const names = getOmgToolNames({ includeSkills: false });
            expect(names).toHaveLength(withoutSkills);
            expect(names.every(n => !n.includes('load_omg_skills') && !n.includes('list_omg_skills'))).toBe(true);
        });
        it('should have 3 skills tools', () => {
            const skillsTools = omgToolNames.filter(n => n.includes('load_omg_skills') || n.includes('list_omg_skills'));
            expect(skillsTools).toHaveLength(3);
        });
        it('supports includeInterop filter option', () => {
            const withInterop = getOmgToolNames({ includeInterop: true });
            const withoutInterop = getOmgToolNames({ includeInterop: false });
            if (interopEnabled) {
                expect(withInterop.some(n => n.includes('interop_'))).toBe(true);
            }
            expect(withoutInterop.some(n => n.includes('interop_'))).toBe(false);
        });
    });
    describe('omgToolsServer', () => {
        it('should be defined', () => {
            expect(omgToolsServer).toBeDefined();
        });
    });
});
//# sourceMappingURL=omg-tools-server.test.js.map