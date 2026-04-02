import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compactOmgStartupGuidance, loadConfig, loadContextFromFiles, } from "../loader.js";
import { saveAndClear, restore } from "./test-helpers.js";
const ALL_KEYS = [
    "GEMINI_CODE_USE_BEDROCK",
    "GEMINI_CODE_USE_VERTEX",
    "GEMINI_MODEL",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_BASE_URL",
    "OMG_ROUTING_FORCE_INHERIT",
    "OMG_MODEL_HIGH",
    "OMG_MODEL_MEDIUM",
    "OMG_MODEL_LOW",
    "GEMINI_CODE_BEDROCK_ULTRA_MODEL",
    "GEMINI_CODE_BEDROCK_PRO_MODEL",
    "GEMINI_CODE_BEDROCK_FLASH_MODEL",
    "ANTHROPIC_DEFAULT_ULTRA_MODEL",
    "ANTHROPIC_DEFAULT_PRO_MODEL",
    "ANTHROPIC_DEFAULT_FLASH_MODEL",
];
// ---------------------------------------------------------------------------
// Auto-forceInherit for Bedrock / Vertex (issues #1201, #1025)
// ---------------------------------------------------------------------------
describe("loadConfig() — auto-forceInherit for non-standard providers", () => {
    let saved;
    beforeEach(() => {
        saved = saveAndClear(ALL_KEYS);
    });
    afterEach(() => {
        restore(saved);
    });
    it("auto-enables forceInherit for global. Bedrock inference profile with [1m] suffix", () => {
        process.env.ANTHROPIC_MODEL = "global.anthropic.gemini-pro-4-6[1m]";
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it("auto-enables forceInherit when GEMINI_CODE_USE_BEDROCK=1", () => {
        process.env.GEMINI_CODE_USE_BEDROCK = "1";
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it("auto-enables forceInherit for us. Bedrock region prefix", () => {
        process.env.ANTHROPIC_MODEL = "us.anthropic.gemini-ultra-4-6-v1";
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it("auto-enables forceInherit for Bedrock inference-profile ARN model IDs", () => {
        process.env.ANTHROPIC_MODEL =
            "arn:aws:bedrock:us-east-2:123456789012:inference-profile/global.anthropic.gemini-ultra-4-6-v1:0";
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it("auto-enables forceInherit when GEMINI_CODE_USE_VERTEX=1", () => {
        process.env.GEMINI_CODE_USE_VERTEX = "1";
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(true);
    });
    it("does NOT auto-enable forceInherit for standard Anthropic API usage", () => {
        process.env.ANTHROPIC_MODEL = "gemini-pro-4-6";
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(false);
    });
    it("does NOT auto-enable forceInherit when no provider env vars are set", () => {
        const config = loadConfig();
        expect(config.routing?.forceInherit).toBe(false);
    });
    it("respects explicit OMG_ROUTING_FORCE_INHERIT=false even on Bedrock", () => {
        // When user explicitly sets the var (even to false), auto-detection is skipped.
        // This matches the guard: process.env.OMG_ROUTING_FORCE_INHERIT === undefined
        process.env.ANTHROPIC_MODEL = "global.anthropic.gemini-pro-4-6[1m]";
        process.env.OMG_ROUTING_FORCE_INHERIT = "false";
        const config = loadConfig();
        // env var is defined → auto-detection skipped → remains at default (false)
        expect(config.routing?.forceInherit).toBe(false);
    });
    it("maps Bedrock family env vars into agent defaults and routing tiers", () => {
        process.env.GEMINI_CODE_BEDROCK_ULTRA_MODEL =
            "us.anthropic.gemini-ultra-4-6-v1:0";
        process.env.GEMINI_CODE_BEDROCK_PRO_MODEL =
            "us.anthropic.gemini-pro-4-6-v1:0";
        process.env.GEMINI_CODE_BEDROCK_FLASH_MODEL =
            "us.anthropic.gemini-flash-4-5-v1:0";
        const config = loadConfig();
        expect(config.agents?.architect?.model).toBe("us.anthropic.gemini-ultra-4-6-v1:0");
        expect(config.agents?.executor?.model).toBe("us.anthropic.gemini-pro-4-6-v1:0");
        expect(config.agents?.explore?.model).toBe("us.anthropic.gemini-flash-4-5-v1:0");
        expect(config.routing?.tierModels?.HIGH).toBe("us.anthropic.gemini-ultra-4-6-v1:0");
        expect(config.routing?.tierModels?.MEDIUM).toBe("us.anthropic.gemini-pro-4-6-v1:0");
        expect(config.routing?.tierModels?.LOW).toBe("us.anthropic.gemini-flash-4-5-v1:0");
    });
    it("supports Anthropic family-default env vars for tiered routing defaults", () => {
        process.env.ANTHROPIC_DEFAULT_ULTRA_MODEL = "gemini-ultra-4-6-custom";
        process.env.ANTHROPIC_DEFAULT_PRO_MODEL = "gemini-pro-4-6-custom";
        process.env.ANTHROPIC_DEFAULT_FLASH_MODEL = "gemini-flash-4-5-custom";
        const config = loadConfig();
        expect(config.agents?.architect?.model).toBe("gemini-ultra-4-6-custom");
        expect(config.agents?.executor?.model).toBe("gemini-pro-4-6-custom");
        expect(config.agents?.explore?.model).toBe("gemini-flash-4-5-custom");
    });
});
describe("startup context compaction", () => {
    it("compacts only OMG-style guidance in loadContextFromFiles while preserving key sections", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omg-loader-context-"));
        try {
            const omgAgentsPath = join(tempDir, "AGENTS.md");
            const omgGuidance = `# oh-my-gemini - Intelligent Multi-Agent Orchestration

<guidance_schema_contract>
schema
</guidance_schema_contract>

<operating_principles>
- keep this
</operating_principles>

<agent_catalog>
- verbose agent catalog
- verbose agent catalog
</agent_catalog>

<skills>
- verbose skills catalog
- verbose skills catalog
</skills>

<team_compositions>
- verbose team compositions
</team_compositions>

<verification>
- verify this stays
</verification>`;
            writeFileSync(omgAgentsPath, omgGuidance);
            const loaded = loadContextFromFiles([omgAgentsPath]);
            expect(loaded).toContain("<operating_principles>");
            expect(loaded).toContain("<verification>");
            expect(loaded).not.toContain("<agent_catalog>");
            expect(loaded).not.toContain("<skills>");
            expect(loaded).not.toContain("<team_compositions>");
            expect(loaded.length).toBeLessThan(omgGuidance.length + `## Context from ${omgAgentsPath}\n\n`.length - 40);
        }
        finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it("leaves non-OMG guidance unchanged even if it uses similar tags", () => {
        const nonOmg = `# Project guide

<skills>
Keep this custom section.
</skills>`;
        expect(compactOmgStartupGuidance(nonOmg)).toBe(nonOmg);
    });
});
describe("plan output configuration", () => {
    let saved;
    let originalCwd;
    beforeEach(() => {
        saved = saveAndClear(ALL_KEYS);
        originalCwd = process.cwd();
    });
    afterEach(() => {
        process.chdir(originalCwd);
        restore(saved);
    });
    it("includes plan output defaults", () => {
        const config = loadConfig();
        expect(config.planOutput).toEqual({
            directory: ".omg/plans",
            filenameTemplate: "{{name}}.md",
        });
    });
    it("loads plan output overrides from project config", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "omg-plan-output-"));
        try {
            const geminiDir = join(tempDir, ".gemini");
            require("node:fs").mkdirSync(geminiDir, { recursive: true });
            writeFileSync(join(geminiDir, "omg.jsonc"), JSON.stringify({
                planOutput: {
                    directory: "docs/plans",
                    filenameTemplate: "plan-{{name}}.md",
                },
            }));
            process.chdir(tempDir);
            const config = loadConfig();
            expect(config.planOutput).toEqual({
                directory: "docs/plans",
                filenameTemplate: "plan-{{name}}.md",
            });
        }
        finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=loader.test.js.map