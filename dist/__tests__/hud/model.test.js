import { describe, it, expect } from 'vitest';
import { formatModelName, renderModel } from '../../hud/elements/model.js';
describe('model element', () => {
    describe('formatModelName', () => {
        it('returns Ultra for ultra model IDs', () => {
            expect(formatModelName('gemini-ultra-4-6-20260205')).toBe('Ultra');
            expect(formatModelName('gemini-3-ultra-20240229')).toBe('Ultra');
        });
        it('returns Pro for pro model IDs', () => {
            expect(formatModelName('gemini-pro-4-20250514')).toBe('Pro');
            expect(formatModelName('gemini-3-5-pro-20241022')).toBe('Pro');
        });
        it('returns Flash for flash model IDs', () => {
            expect(formatModelName('gemini-3-flash-20240307')).toBe('Flash');
        });
        it('returns null for null/undefined', () => {
            expect(formatModelName(null)).toBeNull();
            expect(formatModelName(undefined)).toBeNull();
        });
        it('returns versioned name from model IDs', () => {
            expect(formatModelName('gemini-ultra-4-6-20260205', 'versioned')).toBe('Ultra 4.6');
            expect(formatModelName('gemini-pro-4-6-20260217', 'versioned')).toBe('Pro 4.6');
            expect(formatModelName('gemini-flash-4-5-20251001', 'versioned')).toBe('Flash 4.5');
        });
        it('returns versioned name from display names', () => {
            expect(formatModelName('Pro 4.5', 'versioned')).toBe('Pro 4.5');
            expect(formatModelName('Ultra 4.6', 'versioned')).toBe('Ultra 4.6');
            expect(formatModelName('Flash 4.5', 'versioned')).toBe('Flash 4.5');
        });
        it('falls back to short name when no version found', () => {
            expect(formatModelName('gemini-3-ultra-20240229', 'versioned')).toBe('Ultra');
        });
        it('returns full model ID in full format', () => {
            expect(formatModelName('gemini-ultra-4-6-20260205', 'full')).toBe('gemini-ultra-4-6-20260205');
        });
        it('truncates long unrecognized model names', () => {
            const longName = 'some-very-long-model-name-that-exceeds-limit';
            expect(formatModelName(longName)?.length).toBeLessThanOrEqual(20);
        });
    });
    describe('renderModel', () => {
        it('renders formatted model name', () => {
            const result = renderModel('gemini-ultra-4-6-20260205');
            expect(result).not.toBeNull();
            expect(result).toContain('Ultra');
        });
        it('renders versioned format', () => {
            const result = renderModel('gemini-ultra-4-6-20260205', 'versioned');
            expect(result).not.toBeNull();
            expect(result).toContain('Ultra');
            expect(result).toContain('4.6');
        });
        it('renders full format', () => {
            const result = renderModel('gemini-ultra-4-6-20260205', 'full');
            expect(result).not.toBeNull();
            expect(result).toContain('gemini-ultra-4-6');
        });
        it('returns null for null input', () => {
            expect(renderModel(null)).toBeNull();
        });
    });
});
//# sourceMappingURL=model.test.js.map