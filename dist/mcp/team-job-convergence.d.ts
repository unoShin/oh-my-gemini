export interface OmgTeamJob {
    status: 'running' | 'completed' | 'failed' | 'timeout';
    result?: string;
    stderr?: string;
    startedAt: number;
    pid?: number;
    paneIds?: string[];
    leaderPaneId?: string;
    teamName?: string;
    cwd?: string;
    cleanedUpAt?: string;
}
export declare function convergeJobWithResultArtifact(job: OmgTeamJob, jobId: string, omgJobsDir: string): {
    job: OmgTeamJob;
    changed: boolean;
};
export declare function isJobTerminal(job: OmgTeamJob): boolean;
export declare function clearScopedTeamState(job: Pick<OmgTeamJob, 'cwd' | 'teamName'>): string;
//# sourceMappingURL=team-job-convergence.d.ts.map