/**
 * Tests for omg update --force-hooks protection (issue #722)
 *
 * Verifies that the hook merge logic in install() correctly:
 *   - merges OMG hooks with existing non-OMG hooks during `omg update` (force=true)
 *   - warns when non-OMG hooks are present
 *   - only fully replaces when --force-hooks is explicitly set
 *
 * Tests exercise isOmgHook() and the merge logic via unit-level helpers
 * to avoid filesystem side-effects.
 */
export {};
//# sourceMappingURL=installer-hooks-merge.test.d.ts.map