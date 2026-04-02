/**
 * Tests for GEMINI.md Merge (Task T5)
 * Tests merge-based GEMINI.md updates with markers and backups
 */
import { describe, it, expect } from 'vitest';
import { mergeGeminiMd } from '../index.js';
const START_MARKER = '<!-- OMG:START -->';
const END_MARKER = '<!-- OMG:END -->';
const USER_CUSTOMIZATIONS = '<!-- User customizations -->';
const USER_CUSTOMIZATIONS_RECOVERED = '<!-- User customizations (recovered from corrupted markers) -->';
describe('mergeGeminiMd', () => {
    const omgContent = '# OMG Configuration\n\nThis is the OMG content.';
    describe('Fresh install (no existing content)', () => {
        it('wraps omgContent in markers', () => {
            const result = mergeGeminiMd(null, omgContent);
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
            expect(result).toContain(omgContent);
            expect(result.indexOf(START_MARKER)).toBeLessThan(result.indexOf(omgContent));
            expect(result.indexOf(omgContent)).toBeLessThan(result.indexOf(END_MARKER));
        });
        it('has correct structure for fresh install', () => {
            const result = mergeGeminiMd(null, omgContent);
            const expected = `${START_MARKER}\n${omgContent}\n${END_MARKER}\n`;
            expect(result).toBe(expected);
        });
    });
    describe('Update existing content with markers', () => {
        it('removes all marker blocks and preserves only user content outside them', () => {
            const existingContent = `Some header content\n\n${START_MARKER}\n# Old OMG Content\nOld stuff here.\n${END_MARKER}\n\nUser's custom content\nMore custom stuff`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result).toContain(omgContent);
            expect(result).toContain(USER_CUSTOMIZATIONS);
            expect(result).toContain('Some header content');
            expect(result).toContain('User\'s custom content');
            expect(result).not.toContain('Old OMG Content');
            expect(result).not.toContain('Old stuff here');
            expect((result.match(/<!-- OMG:START -->/g) || []).length).toBe(1);
            expect((result.match(/<!-- OMG:END -->/g) || []).length).toBe(1);
        });
        it('normalizes preserved content under the user customizations section', () => {
            const beforeContent = 'This is before the marker\n\n';
            const afterContent = '\n\nThis is after the marker';
            const existingContent = `${beforeContent}${START_MARKER}\nOld content\n${END_MARKER}${afterContent}`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result.startsWith(`${START_MARKER}\n${omgContent}\n${END_MARKER}`)).toBe(true);
            expect(result).toContain(USER_CUSTOMIZATIONS);
            expect(result).toContain('This is before the marker');
            expect(result).toContain('This is after the marker');
            expect(result).toContain(omgContent);
        });
        it('keeps remaining user content after stripping marker blocks', () => {
            const existingContent = `Header\n${START_MARKER}\nOld\n${END_MARKER}\nFooter`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result).toBe(`${START_MARKER}\n${omgContent}\n${END_MARKER}\n\n${USER_CUSTOMIZATIONS}\nHeader\nFooter`);
        });
    });
    describe('No markers in existing content', () => {
        it('wraps omgContent in markers and preserves existing content after user customizations header', () => {
            const existingContent = '# My Custom Config\n\nCustom settings here.';
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
            expect(result).toContain(omgContent);
            expect(result).toContain(USER_CUSTOMIZATIONS);
            expect(result).toContain('# My Custom Config');
            expect(result).toContain('Custom settings here.');
            // Check order: OMG section first, then user customizations header, then existing content
            const omgIndex = result.indexOf(START_MARKER);
            const customizationsIndex = result.indexOf(USER_CUSTOMIZATIONS);
            const existingIndex = result.indexOf('# My Custom Config');
            expect(omgIndex).toBeLessThan(customizationsIndex);
            expect(customizationsIndex).toBeLessThan(existingIndex);
        });
        it('has correct structure when adding markers to existing content', () => {
            const existingContent = 'Existing content';
            const result = mergeGeminiMd(existingContent, omgContent);
            const expected = `${START_MARKER}\n${omgContent}\n${END_MARKER}\n\n${USER_CUSTOMIZATIONS}\n${existingContent}`;
            expect(result).toBe(expected);
        });
    });
    describe('Corrupted markers', () => {
        it('handles START marker without END marker', () => {
            const existingContent = `${START_MARKER}\nSome content\nMore content`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
            expect(result).toContain(omgContent);
            expect(result).toContain(USER_CUSTOMIZATIONS_RECOVERED);
            // Original corrupted content should be preserved after user customizations
            expect(result).toContain('Some content');
        });
        it('handles END marker without START marker', () => {
            const existingContent = `Some content\n${END_MARKER}\nMore content`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
            expect(result).toContain(omgContent);
            expect(result).toContain(USER_CUSTOMIZATIONS_RECOVERED);
            // Original corrupted content should be preserved
            expect(result).toContain('Some content');
            expect(result).toContain('More content');
        });
        it('handles END marker before START marker (invalid order)', () => {
            const existingContent = `${END_MARKER}\nContent\n${START_MARKER}`;
            const result = mergeGeminiMd(existingContent, omgContent);
            // Should treat as corrupted and wrap new content, preserving old
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
            expect(result).toContain(omgContent);
            expect(result).toContain(USER_CUSTOMIZATIONS_RECOVERED);
        });
        it('does not grow unboundedly when called repeatedly with corrupted markers', () => {
            // Regression: corrupted markers caused existingContent (including corrupted markers)
            // to be appended as-is. Next call re-detected corruption, appended again → unbounded growth.
            const corruptedContent = `${START_MARKER}\nUser stuff\nMore user stuff`;
            const firstResult = mergeGeminiMd(corruptedContent, omgContent);
            // Call again with the output of the first call
            const secondResult = mergeGeminiMd(firstResult, omgContent);
            // The file should NOT grow unboundedly — second call should produce
            // similar or equal length output as the first call
            expect(secondResult.length).toBeLessThanOrEqual(firstResult.length * 1.1);
            // The corrupted markers should be stripped from recovered content
            // so re-processing doesn't re-detect corruption and re-append
            const thirdResult = mergeGeminiMd(secondResult, omgContent);
            expect(thirdResult.length).toBeLessThanOrEqual(secondResult.length * 1.1);
        });
        it('strips unmatched OMG markers from recovered content', () => {
            const corruptedContent = `${START_MARKER}\nUser custom config`;
            const result = mergeGeminiMd(corruptedContent, omgContent);
            // The recovered section should not contain bare OMG markers
            // Count occurrences of START_MARKER: should only appear once (in the OMG block)
            const startMarkerCount = (result.match(new RegExp(START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            expect(startMarkerCount).toBe(1);
        });
    });
    describe('Edge cases', () => {
        it('handles empty omgContent', () => {
            const existingContent = `${START_MARKER}\nOld content\n${END_MARKER}`;
            const result = mergeGeminiMd(existingContent, '');
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
            expect(result).not.toContain('Old content');
        });
        it('handles whitespace-only existing content', () => {
            const existingContent = '   \n\n   ';
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
            expect(result).toContain(omgContent);
            expect(result).not.toContain(USER_CUSTOMIZATIONS);
        });
        it('handles multi-line omgContent', () => {
            const multiLineOmg = 'Line 1\nLine 2\nLine 3\n\nLine 5';
            const result = mergeGeminiMd(null, multiLineOmg);
            expect(result).toContain(multiLineOmg);
            expect(result.split('\n').length).toBeGreaterThan(5);
        });
        it('preserves multiple occurrences of marker-like text in user content', () => {
            const existingContent = `${START_MARKER}\nOMG Content\n${END_MARKER}\n\nUser content mentions ${START_MARKER} in text`;
            const result = mergeGeminiMd(existingContent, omgContent);
            // Only first pair of markers should be used
            expect(result).toContain(omgContent);
            expect(result).toContain('User content mentions');
            expect(result.split(START_MARKER).length).toBe(3); // Two START_MARKERs total (one pair + one in text)
        });
        it('handles very large existing content', () => {
            const largeContent = 'x'.repeat(100000);
            const existingContent = `${START_MARKER}\nOld\n${END_MARKER}\n${largeContent}`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect(result).toContain(omgContent);
            expect(result).toContain(largeContent);
            expect(result.length).toBeGreaterThan(100000);
        });
    });
    describe('Real-world scenarios', () => {
        it('handles typical fresh install scenario', () => {
            const result = mergeGeminiMd(null, omgContent);
            expect(result).toMatch(/^<!-- OMG:START -->\n.*\n<!-- OMG:END -->\n$/s);
        });
        it('handles typical update scenario with user customizations', () => {
            const existingContent = `${START_MARKER}
# Old OMG Config v1.0
Old instructions here.
${END_MARKER}

${USER_CUSTOMIZATIONS}
# My Project-Specific Instructions
- Use TypeScript strict mode
- Follow company coding standards`;
            const newOmgContent = '# OMG Config v2.0\nNew instructions with updates.';
            const result = mergeGeminiMd(existingContent, newOmgContent);
            expect(result).toContain('# OMG Config v2.0');
            expect(result).not.toContain('Old instructions here');
            expect(result).toContain('# My Project-Specific Instructions');
            expect(result).toContain('Follow company coding standards');
            expect((result.match(/<!-- OMG:START -->/g) || []).length).toBe(1);
            expect((result.match(/<!-- OMG:END -->/g) || []).length).toBe(1);
        });
        it('handles migration from old version without markers', () => {
            const oldContent = `# Legacy GEMINI.md
Some old configuration
User added custom stuff here`;
            const result = mergeGeminiMd(oldContent, omgContent);
            // New OMG content should be at the top with markers
            expect(result.indexOf(START_MARKER)).toBeLessThan(result.indexOf('# Legacy GEMINI.md'));
            expect(result).toContain(omgContent);
            expect(result).toContain(oldContent);
            expect(result).toContain(USER_CUSTOMIZATIONS);
        });
    });
    describe('idempotency guard', () => {
        it('strips markers from omgContent that already has markers', () => {
            // Simulate docs/GEMINI.md shipping with markers already
            const omgWithMarkers = `<!-- OMG:START -->
# oh-my-gemini
Agent instructions here
<!-- OMG:END -->`;
            const result = mergeGeminiMd(null, omgWithMarkers);
            // Should NOT have nested markers
            const startCount = (result.match(/<!-- OMG:START -->/g) || []).length;
            const endCount = (result.match(/<!-- OMG:END -->/g) || []).length;
            expect(startCount).toBe(1);
            expect(endCount).toBe(1);
            expect(result).toContain('Agent instructions here');
        });
        it('handles omgContent with markers when merging into existing content', () => {
            const existingContent = `<!-- OMG:START -->
Old OMG content
<!-- OMG:END -->

<!-- User customizations -->
My custom stuff`;
            const omgWithMarkers = `<!-- OMG:START -->
New OMG content v2
<!-- OMG:END -->`;
            const result = mergeGeminiMd(existingContent, omgWithMarkers);
            // Should have exactly one pair of markers
            const startCount = (result.match(/<!-- OMG:START -->/g) || []).length;
            const endCount = (result.match(/<!-- OMG:END -->/g) || []).length;
            expect(startCount).toBe(1);
            expect(endCount).toBe(1);
            expect(result).toContain('New OMG content v2');
            expect(result).not.toContain('Old OMG content');
            expect(result).toContain('My custom stuff');
        });
    });
    describe('version marker sync', () => {
        it('injects the provided version marker on fresh install', () => {
            const result = mergeGeminiMd(null, omgContent, '4.6.7');
            expect(result).toContain('<!-- OMG:VERSION:4.6.7 -->');
            expect(result).toContain(START_MARKER);
            expect(result).toContain(END_MARKER);
        });
        it('replaces stale version marker when updating existing marker block', () => {
            const existingContent = `${START_MARKER}
<!-- OMG:VERSION:4.5.0 -->
Old content
${END_MARKER}

${USER_CUSTOMIZATIONS}
my notes`;
            const result = mergeGeminiMd(existingContent, omgContent, '4.6.7');
            expect(result).toContain('<!-- OMG:VERSION:4.6.7 -->');
            expect(result).not.toContain('<!-- OMG:VERSION:4.5.0 -->');
            expect((result.match(/<!-- OMG:VERSION:/g) || []).length).toBe(1);
            expect(result).toContain('my notes');
        });
        it('strips embedded version marker from omg content before inserting current version', () => {
            const omgWithVersion = `<!-- OMG:VERSION:4.0.0 -->\n${omgContent}`;
            const result = mergeGeminiMd(null, omgWithVersion, '4.6.7');
            expect(result).toContain('<!-- OMG:VERSION:4.6.7 -->');
            expect(result).not.toContain('<!-- OMG:VERSION:4.0.0 -->');
            expect((result.match(/<!-- OMG:VERSION:/g) || []).length).toBe(1);
        });
    });
    describe('issue #1467 regression', () => {
        it('removes duplicate legacy OMG blocks from preserved user content', () => {
            const existingContent = `${START_MARKER}
Old OMG content v1
${END_MARKER}

${USER_CUSTOMIZATIONS}
My note before duplicate block

${START_MARKER}
Older duplicate block
${END_MARKER}

My note after duplicate block`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect((result.match(/<!-- OMG:START -->/g) || []).length).toBe(1);
            expect((result.match(/<!-- OMG:END -->/g) || []).length).toBe(1);
            expect(result).toContain(USER_CUSTOMIZATIONS);
            expect(result).toContain('My note before duplicate block');
            expect(result).toContain('My note after duplicate block');
            expect(result).not.toContain('Old OMG content v1');
            expect(result).not.toContain('Older duplicate block');
        });
        it('removes autogenerated user customization headers while preserving real user text', () => {
            const existingContent = `${START_MARKER}
Old OMG content
${END_MARKER}

<!-- User customizations (migrated from previous GEMINI.md) -->
First user note

<!-- User customizations -->
Second user note`;
            const result = mergeGeminiMd(existingContent, omgContent);
            expect((result.match(/<!-- User customizations/g) || []).length).toBe(1);
            expect(result).toContain(`${USER_CUSTOMIZATIONS}\nFirst user note\n\nSecond user note`);
        });
    });
});
//# sourceMappingURL=gemini-md-merge.test.js.map