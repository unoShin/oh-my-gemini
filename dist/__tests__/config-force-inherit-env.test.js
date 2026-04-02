/**
 * Tests for OMG_ROUTING_FORCE_INHERIT environment variable support (issue #1135)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnvConfig } from '../config/loader.js';
describe('OMG_ROUTING_FORCE_INHERIT env var', () => {
    let originalValue;
    beforeEach(() => {
        originalValue = process.env.OMG_ROUTING_FORCE_INHERIT;
    });
    afterEach(() => {
        if (originalValue === undefined) {
            delete process.env.OMG_ROUTING_FORCE_INHERIT;
        }
        else {
            process.env.OMG_ROUTING_FORCE_INHERIT = originalValue;
        }
    });
    it('sets forceInherit to true when env var is "true"', () => {
        process.env.OMG_ROUTING_FORCE_INHERIT = 'true';
        const config = loadEnvConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it('sets forceInherit to false when env var is "false"', () => {
        process.env.OMG_ROUTING_FORCE_INHERIT = 'false';
        const config = loadEnvConfig();
        expect(config.routing?.forceInherit).toBe(false);
    });
    it('does not set forceInherit when env var is not defined', () => {
        delete process.env.OMG_ROUTING_FORCE_INHERIT;
        const config = loadEnvConfig();
        expect(config.routing?.forceInherit).toBeUndefined();
    });
});
//# sourceMappingURL=config-force-inherit-env.test.js.map