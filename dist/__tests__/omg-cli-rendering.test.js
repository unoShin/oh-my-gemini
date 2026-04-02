import { describe, expect, it } from 'vitest';
import { formatOmgCliInvocation, resolveOmgCliPrefix, rewriteOmgCliInvocations, } from '../utils/omg-cli-rendering.js';
describe('omg CLI rendering', () => {
    it('uses omg when the binary is available', () => {
        expect(resolveOmgCliPrefix({ omgAvailable: true, env: {} })).toBe('omg');
        expect(formatOmgCliInvocation('team api claim-task', { omgAvailable: true, env: {} }))
            .toBe('omg team api claim-task');
    });
    it('falls back to the plugin bridge when omg is unavailable but GEMINI_PLUGIN_ROOT is set', () => {
        const env = { GEMINI_PLUGIN_ROOT: '/tmp/plugin-root' };
        expect(resolveOmgCliPrefix({ omgAvailable: false, env }))
            .toBe('node "$GEMINI_PLUGIN_ROOT"/bridge/cli.cjs');
        expect(formatOmgCliInvocation('autoresearch --mission "m"', { omgAvailable: false, env }))
            .toBe('node "$GEMINI_PLUGIN_ROOT"/bridge/cli.cjs autoresearch --mission "m"');
    });
    it('rewrites inline and list-form omg commands for plugin installs', () => {
        const env = { GEMINI_PLUGIN_ROOT: '/tmp/plugin-root' };
        const input = [
            'Run `omg autoresearch --mission "m" --eval "e"`.',
            '- omg team api claim-task --input \'{}\' --json',
            '> omg ask gemini --agent-prompt critic "check"',
        ].join('\n');
        const output = rewriteOmgCliInvocations(input, { omgAvailable: false, env });
        expect(output).toContain('`node "$GEMINI_PLUGIN_ROOT"/bridge/cli.cjs autoresearch --mission "m" --eval "e"`');
        expect(output).toContain('- node "$GEMINI_PLUGIN_ROOT"/bridge/cli.cjs team api claim-task --input \'{}\' --json');
        expect(output).toContain('> node "$GEMINI_PLUGIN_ROOT"/bridge/cli.cjs ask gemini --agent-prompt critic "check"');
    });
    it('leaves text unchanged when omg remains the selected prefix', () => {
        const input = 'Use `omg team status demo` and\nomg team wait demo';
        expect(rewriteOmgCliInvocations(input, { omgAvailable: true, env: {} })).toBe(input);
    });
});
//# sourceMappingURL=omg-cli-rendering.test.js.map