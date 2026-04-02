/**
 * Tests for non-Gemini provider auto-detection (issue #1201)
 * and Vertex AI auto-detection
 *
 * When requests are routed to non-Gemini providers,
 * or when running on Google Vertex AI, OMG should
 * auto-enable forceInherit to avoid passing Gemini-specific model tier
 * names (pro/ultra/flash) that might cause errors on other backends.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isNonGeminiProvider, isVertexAI } from '../config/models.js';
import { loadConfig } from '../config/loader.js';
describe('isNonGeminiProvider (issue #1201)', () => {
    const savedEnv = {};
    const envKeys = [
        'GEMINI_MODEL',
        'GOOGLE_MODEL',
        'GEMINI_BASE_URL',
        'OMG_ROUTING_FORCE_INHERIT',
        'GEMINI_CODE_USE_VERTEX',
    ];
    beforeEach(() => {
        for (const key of envKeys) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });
    afterEach(() => {
        for (const key of envKeys) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = savedEnv[key];
            }
        }
    });
    it('returns false when no env vars are set (default Gemini provider)', () => {
        expect(isNonGeminiProvider()).toBe(false);
    });
    it('returns true when GEMINI_MODEL is a non-Gemini model', () => {
        process.env.GEMINI_MODEL = 'gpt-4o';
        expect(isNonGeminiProvider()).toBe(true);
    });
    it('returns false when GEMINI_MODEL contains "gemini"', () => {
        process.env.GEMINI_MODEL = 'gemini-pro';
        expect(isNonGeminiProvider()).toBe(false);
    });
    it('returns true when GEMINI_BASE_URL is a custom proxy URL', () => {
        process.env.GEMINI_BASE_URL = 'https://my-proxy.example.com/v1';
        expect(isNonGeminiProvider()).toBe(true);
    });
    it('returns true when OMG_ROUTING_FORCE_INHERIT is already true', () => {
        process.env.OMG_ROUTING_FORCE_INHERIT = 'true';
        expect(isNonGeminiProvider()).toBe(true);
    });
    it('detects case-insensitive Gemini in model name', () => {
        process.env.GEMINI_MODEL = 'Gemini-1.5-Flash';
        expect(isNonGeminiProvider()).toBe(false);
    });
    // --- Vertex AI detection ---
    it('returns true when GEMINI_CODE_USE_VERTEX=1', () => {
        process.env.GEMINI_CODE_USE_VERTEX = '1';
        expect(isNonGeminiProvider()).toBe(true);
    });
    it('returns true for Vertex model ID with vertex_ai/ prefix', () => {
        process.env.GEMINI_MODEL = 'vertex_ai/gemini-pro';
        expect(isNonGeminiProvider()).toBe(true);
    });
});
describe('isVertexAI()', () => {
    const savedEnv = {};
    const envKeys = ['GEMINI_CODE_USE_VERTEX', 'GEMINI_MODEL'];
    beforeEach(() => {
        for (const key of envKeys) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });
    afterEach(() => {
        for (const key of envKeys) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = savedEnv[key];
            }
        }
    });
    it('returns true when GEMINI_CODE_USE_VERTEX=1', () => {
        process.env.GEMINI_CODE_USE_VERTEX = '1';
        expect(isVertexAI()).toBe(true);
    });
    it('returns false when GEMINI_CODE_USE_VERTEX is not set', () => {
        expect(isVertexAI()).toBe(false);
    });
    it('detects vertex_ai/ prefix in GEMINI_MODEL', () => {
        process.env.GEMINI_MODEL = 'vertex_ai/gemini-pro';
        expect(isVertexAI()).toBe(true);
    });
    it('is case-insensitive for vertex_ai/ prefix', () => {
        process.env.GEMINI_MODEL = 'Vertex_AI/gemini-flash';
        expect(isVertexAI()).toBe(true);
    });
    it('does not match standard Gemini model IDs', () => {
        process.env.GEMINI_MODEL = 'gemini-pro';
        expect(isVertexAI()).toBe(false);
    });
});
describe('loadConfig auto-enables forceInherit for non-Gemini providers (issue #1201)', () => {
    const savedEnv = {};
    const envKeys = [
        'GEMINI_MODEL',
        'GEMINI_BASE_URL',
        'OMG_ROUTING_FORCE_INHERIT',
        'GEMINI_CODE_USE_VERTEX',
    ];
    beforeEach(() => {
        for (const key of envKeys) {
            savedEnv[key] = process.env[key];
            delete process.env[key];
        }
    });
    afterEach(() => {
        for (const key of envKeys) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = savedEnv[key];
            }
        }
    });
    it('auto-enables forceInherit when GEMINI_MODEL is non-Gemini', () => {
        process.env.GEMINI_MODEL = 'gpt-4o';
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it('auto-enables forceInherit when GEMINI_BASE_URL is set', () => {
        process.env.GEMINI_BASE_URL = 'https://proxy.example.com/v1';
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it('does NOT auto-enable forceInherit for default Gemini setup', () => {
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(false);
    });
    // --- Vertex AI integration ---
    it('auto-enables forceInherit when GEMINI_CODE_USE_VERTEX=1', () => {
        process.env.GEMINI_CODE_USE_VERTEX = '1';
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it('auto-enables forceInherit when Vertex model ID is detected', () => {
        process.env.GEMINI_MODEL = 'vertex_ai/gemini-flash';
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
});
//# sourceMappingURL=non-gemini-provider-detection.test.js.map