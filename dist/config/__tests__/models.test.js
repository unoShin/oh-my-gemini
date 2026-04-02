import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isVertexAI, isNonGeminiProvider, resolveGeminiFamily, } from '../models.js';
import { saveAndClear, restore } from './test-helpers.js';
const VERTEX_KEYS = ['GEMINI_CODE_USE_VERTEX', 'GEMINI_MODEL', 'GOOGLE_MODEL'];
const ALL_KEYS = [
    'GEMINI_CODE_USE_VERTEX',
    'GEMINI_MODEL',
    'GOOGLE_MODEL',
    'GEMINI_BASE_URL',
    'OMG_ROUTING_FORCE_INHERIT',
];
// ---------------------------------------------------------------------------
// isVertexAI()
// ---------------------------------------------------------------------------
describe('isVertexAI()', () => {
    let saved;
    beforeEach(() => { saved = saveAndClear(VERTEX_KEYS); });
    afterEach(() => { restore(saved); });
    it('returns true when GEMINI_CODE_USE_VERTEX=1', () => {
        process.env.GEMINI_CODE_USE_VERTEX = '1';
        expect(isVertexAI()).toBe(true);
    });
    it('detects vertex_ai/ prefix in GEMINI_MODEL', () => {
        process.env.GEMINI_MODEL = 'vertex_ai/gemini-pro';
        expect(isVertexAI()).toBe(true);
    });
    it('returns false when GEMINI_CODE_USE_VERTEX=0', () => {
        process.env.GEMINI_CODE_USE_VERTEX = '0';
        expect(isVertexAI()).toBe(false);
    });
    it('returns false when no relevant env var is set', () => {
        expect(isVertexAI()).toBe(false);
    });
});
// ---------------------------------------------------------------------------
// isNonGeminiProvider()
// ---------------------------------------------------------------------------
describe('isNonGeminiProvider()', () => {
    let saved;
    beforeEach(() => { saved = saveAndClear(ALL_KEYS); });
    afterEach(() => { restore(saved); });
    it('returns true when GEMINI_CODE_USE_VERTEX=1', () => {
        process.env.GEMINI_CODE_USE_VERTEX = '1';
        expect(isNonGeminiProvider()).toBe(true);
    });
    it('returns true when OMG_ROUTING_FORCE_INHERIT=true', () => {
        process.env.OMG_ROUTING_FORCE_INHERIT = 'true';
        expect(isNonGeminiProvider()).toBe(true);
    });
    it('returns false for standard Gemini model IDs', () => {
        process.env.GEMINI_MODEL = 'gemini-pro';
        expect(isNonGeminiProvider()).toBe(false);
    });
    it('returns false when no env vars are set', () => {
        expect(isNonGeminiProvider()).toBe(false);
    });
});
// ---------------------------------------------------------------------------
// resolveGeminiFamily() — ensure model IDs map to correct families
// ---------------------------------------------------------------------------
describe('resolveGeminiFamily()', () => {
    it('resolves flash model IDs to FLASH', () => {
        expect(resolveGeminiFamily('gemini-flash')).toBe('FLASH');
    });
    it('resolves pro model IDs to PRO', () => {
        expect(resolveGeminiFamily('gemini-pro')).toBe('PRO');
    });
    it('resolves ultra model IDs to ULTRA', () => {
        expect(resolveGeminiFamily('gemini-ultra')).toBe('ULTRA');
    });
    it('returns null for non-Gemini model IDs', () => {
        expect(resolveGeminiFamily('gpt-4o')).toBeNull();
    });
    it('returns null for bare aliases not containing family name', () => {
        expect(resolveGeminiFamily('custom-model')).toBeNull();
    });
});
//# sourceMappingURL=models.test.js.map