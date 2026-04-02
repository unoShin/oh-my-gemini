import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
function readProjectFile(...segments) {
    return readFileSync(join(PROJECT_ROOT, ...segments), 'utf-8');
}
describe('Tier-0 contract docs consistency', () => {
    const referenceDoc = readProjectFile('docs', 'REFERENCE.md');
    const geminiDoc = readProjectFile('docs', 'GEMINI.md');
    it('keeps REFERENCE ToC counts aligned with section headings', () => {
        const tocAgents = referenceDoc.match(/\[Agents \((\d+) Total\)\]\(#agents-\d+-total\)/);
        const headingAgents = referenceDoc.match(/^## Agents \((\d+) Total\)$/m);
        const tocSkills = referenceDoc.match(/\[Skills \((\d+) Total\)\]\(#skills-\d+-total\)/);
        const headingSkills = referenceDoc.match(/^## Skills \((\d+) Total\)$/m);
        expect(tocAgents?.[1]).toBe(headingAgents?.[1]);
        expect(tocSkills?.[1]).toBe(headingSkills?.[1]);
    });
    it('documents all Tier-0 slash commands in REFERENCE.md', () => {
        for (const skillName of ['autopilot', 'ultrawork', 'ralph', 'team', 'ralplan']) {
            expect(referenceDoc).toContain(`/oh-my-gemini:${skillName}`);
        }
    });
    it('documents all Tier-0 keywords in GEMINI.md', () => {
        for (const keyword of ['autopilot', 'ultrawork', 'ralph', 'team', 'ralplan']) {
            expect(geminiDoc).toContain(`\`${keyword}\``);
        }
    });
    it('does not contain blank placeholder rows in core skill/command docs', () => {
        expect(referenceDoc).not.toContain('| `` |');
        expect(referenceDoc).not.toContain('/oh-my-gemini: <task>');
        expect(referenceDoc).not.toContain('incl. )');
    });
    it('keeps ralplan documented as a keyword trigger', () => {
        expect(geminiDoc).toContain('"ralplan"→ralplan');
    });
    it('keeps deprecated compatibility aliases documented for project session manager', () => {
        // swarm alias removed in #1131
        expect(referenceDoc).toContain('project-session-manager');
        expect(referenceDoc).toContain('`psm` | **Deprecated** compatibility alias for `project-session-manager`');
    });
    it('does not document removed wrapper slash commands as installed skills', () => {
        expect(referenceDoc).not.toContain('/oh-my-gemini:analyze <target>');
        expect(referenceDoc).not.toContain('/oh-my-gemini:tdd <feature>');
    });
    it('documents team as explicit-only rather than an auto-triggered keyword', () => {
        expect(geminiDoc).toContain('Team orchestration is explicit via `/team`.');
        expect(referenceDoc).not.toContain('| `team`, `coordinated team`');
    });
    it('keeps install and update guidance aligned on canonical setup entrypoints', () => {
        const localPluginDoc = readProjectFile('docs', 'LOCAL_PLUGIN_INSTALL.md');
        expect(geminiDoc).toContain('Say "setup omg" or run `/oh-my-gemini:omg-setup`.');
        expect(referenceDoc).toContain('/oh-my-gemini:setup');
        expect(localPluginDoc).toContain('/setup');
        expect(localPluginDoc).toContain('git worktrees');
    });
    it('keeps root AGENTS.md aligned with OMG branding and state paths', () => {
        const agentsDoc = readProjectFile('AGENTS.md');
        expect(agentsDoc).toContain('# oh-my-gemini - Intelligent Multi-Agent Orchestration');
        expect(agentsDoc).toContain('You are running with oh-my-gemini (OMG), a multi-agent orchestration layer for Gemini Code.');
        expect(agentsDoc).toContain('`.omg/state/`');
        expect(agentsDoc).toContain('Run `omg setup` to install all components. Run `omg doctor` to verify installation.');
        expect(agentsDoc).not.toContain('oh-my-gemini');
        expect(agentsDoc).not.toContain('OMX_TEAM_WORKER_LAUNCH_ARGS');
        expect(agentsDoc).not.toContain('gpt-5.3-gemini-spark');
    });
    it('keeps benchmark default model references aligned across docs and scripts', () => {
        const benchmarkReadme = readProjectFile('benchmark', 'README.md');
        const benchmarkRunner = readProjectFile('benchmark', 'run_benchmark.py');
        const quickTest = readProjectFile('benchmark', 'quick_test.sh');
        const vanilla = readProjectFile('benchmark', 'run_vanilla.sh');
        const omg = readProjectFile('benchmark', 'run_omg.sh');
        const fullComparison = readProjectFile('benchmark', 'run_full_comparison.sh');
        const resultsReadme = readProjectFile('benchmark', 'results', 'README.md');
        const expectedModel = 'gemini-pro-4-6-20260217';
        for (const content of [benchmarkReadme, benchmarkRunner, quickTest, vanilla, omg, fullComparison, resultsReadme]) {
            expect(content).toContain(expectedModel);
        }
        expect(benchmarkReadme).not.toContain('gemini-pro-4.5-20250929');
        expect(benchmarkRunner).not.toContain('gemini-pro-4-20250514');
        expect(resultsReadme).toContain('Gemini Pro 4.6');
    });
    it('removes dead package build aliases and keeps seminar demo model guidance current', () => {
        const packageJson = JSON.parse(readProjectFile('package.json'));
        const seminarDemo = readProjectFile('seminar', 'demos', 'demo-0-live-audience.md');
        expect(packageJson.scripts).not.toHaveProperty('build:gemini');
        expect(packageJson.scripts).not.toHaveProperty('build:gemini');
        expect(seminarDemo).toContain('# 빠른 모델 (Pro 4.6)');
        expect(seminarDemo).toContain('export OMG_MODEL=anthropic/gemini-pro-4-6');
        expect(seminarDemo).not.toContain('anthropic/gemini-pro-4-5');
    });
});
//# sourceMappingURL=tier0-docs-consistency.test.js.map