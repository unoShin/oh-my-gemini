import { isCliAvailable } from '../../team/model-contract.js';
export function detectSkillRuntimeAvailability(detector = isCliAvailable) {
    return {
        gemini: detector('gemini'),
    };
}
function normalizeSkillName(skillName) {
    return skillName.trim().toLowerCase();
}
function renderDeepInterviewRuntimeGuidance(availability) {
    if (!availability.gemini) {
        return '';
    }
    return [
        '## Provider-Aware Execution Recommendations',
        'When Phase 5 presents post-interview execution choices, keep the Gemini-only defaults above and add these Gemini variants because Gemini CLI is available:',
        '',
        '- `/ralplan --architect gemini "<spec or task>"` — Gemini handles the architect pass; best for implementation-heavy design review; higher cost than Gemini-only ralplan.',
        '- `/ralplan --critic gemini "<spec or task>"` — Gemini handles the critic pass; cheaper than moving the full loop off Gemini; strong second-opinion review.',
        '- `/ralph --critic gemini "<spec or task>"` — Ralph still executes normally, but final verification goes through the Gemini critic; smallest multi-provider upgrade.',
        '',
        'If Gemini becomes unavailable, briefly note that and fall back to the Gemini-only recommendations already listed in Phase 5.',
    ].join('\n');
}
export function renderSkillRuntimeGuidance(skillName, availability) {
    switch (normalizeSkillName(skillName)) {
        case 'deep-interview':
            return renderDeepInterviewRuntimeGuidance(availability ?? detectSkillRuntimeAvailability());
        default:
            return '';
    }
}
//# sourceMappingURL=runtime-guidance.js.map