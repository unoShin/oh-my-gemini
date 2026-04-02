import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const savedInteropFlag = process.env.OMG_INTEROP_TOOLS_ENABLED;
async function importFresh() {
    vi.resetModules();
    return import('../mcp/omg-tools-server.js');
}
describe('omg-tools-server interop gating', () => {
    beforeEach(() => {
        delete process.env.OMG_INTEROP_TOOLS_ENABLED;
    });
    afterEach(() => {
        if (savedInteropFlag === undefined) {
            delete process.env.OMG_INTEROP_TOOLS_ENABLED;
        }
        else {
            process.env.OMG_INTEROP_TOOLS_ENABLED = savedInteropFlag;
        }
        vi.resetModules();
    });
    it('does not register interop tools by default', async () => {
        const mod = await importFresh();
        expect(mod.omgToolNames.some((name) => name.includes('interop_'))).toBe(false);
    }, 15000);
    it('registers interop tools when OMG_INTEROP_TOOLS_ENABLED=1', async () => {
        process.env.OMG_INTEROP_TOOLS_ENABLED = '1';
        const mod = await importFresh();
        expect(mod.omgToolNames).toContain('mcp__t__interop_send_task');
        expect(mod.omgToolNames).toContain('mcp__t__interop_send_omx_message');
    });
    it('filters interop tools when includeInterop=false', async () => {
        process.env.OMG_INTEROP_TOOLS_ENABLED = '1';
        const mod = await importFresh();
        const withInterop = mod.getOmgToolNames({ includeInterop: true });
        const withoutInterop = mod.getOmgToolNames({ includeInterop: false });
        expect(withInterop.some((name) => name.includes('interop_'))).toBe(true);
        expect(withoutInterop.some((name) => name.includes('interop_'))).toBe(false);
    });
});
//# sourceMappingURL=omg-tools-server-interop.test.js.map