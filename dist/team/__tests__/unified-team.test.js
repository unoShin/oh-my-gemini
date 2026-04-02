import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getTeamMembers } from '../unified-team.js';
import { registerMcpWorker } from '../team-registration.js';
import { writeHeartbeat } from '../heartbeat.js';
describe('unified-team', () => {
    let testDir;
    const teamName = 'test-unified';
    beforeEach(() => {
        testDir = mkdtempSync(join(tmpdir(), 'unified-team-test-'));
    });
    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });
    function registerWorker(name, agentType = 'mcp-gemini') {
        const provider = agentType.startsWith('mcp-') ? agentType.slice(4) : 'gemini';
        registerMcpWorker(teamName, name, provider, 'gemini-pro-preview', `tmux-${name}`, testDir, testDir);
    }
    describe('getTeamMembers', () => {
        it('returns empty array when no members exist', () => {
            const members = getTeamMembers(teamName, testDir);
            expect(members).toEqual([]);
        });
        it('includes MCP workers from shadow registry', () => {
            registerWorker('gemini-1', 'mcp-gemini');
            const members = getTeamMembers(teamName, testDir);
            expect(members).toHaveLength(2);
            const gemini = members.find(m => m.name === 'gemini-1');
            expect(gemini).toBeDefined();
            expect(gemini.backend).toBe('mcp-gemini');
            expect(gemini.capabilities).toContain('code-review');
            const gemini2 = members.find(m => m.name === 'gemini-1');
            expect(gemini2).toBeDefined();
            expect(gemini2.backend).toBe('mcp-gemini');
            expect(gemini2.capabilities).toContain('ui-design');
        });
        it('reflects heartbeat status', () => {
            registerWorker('worker1');
            writeHeartbeat(testDir, {
                workerName: 'worker1',
                teamName,
                provider: 'gemini',
                pid: process.pid,
                lastPollAt: new Date().toISOString(),
                status: 'executing',
                consecutiveErrors: 0,
                currentTaskId: 'task-42',
            });
            const members = getTeamMembers(teamName, testDir);
            expect(members[0].status).toBe('active');
            expect(members[0].currentTaskId).toBe('task-42');
        });
        it('marks dead workers with stale heartbeat', () => {
            registerWorker('worker1');
            writeHeartbeat(testDir, {
                workerName: 'worker1',
                teamName,
                provider: 'gemini',
                pid: process.pid,
                lastPollAt: new Date(Date.now() - 120000).toISOString(), // 2 min ago
                status: 'polling',
                consecutiveErrors: 0,
            });
            const members = getTeamMembers(teamName, testDir);
            expect(members[0].status).toBe('dead');
        });
        it('handles team with only MCP workers', () => {
            registerWorker('gemini-1');
            const members = getTeamMembers(teamName, testDir);
            expect(members).toHaveLength(1);
            expect(members[0].backend).toBe('mcp-gemini');
        });
    });
});
//# sourceMappingURL=unified-team.test.js.map