/**
 * Configuration Loader
 *
 * Handles loading and merging configuration from multiple sources:
 * - User config: ~/.config/gemini-omg/config.jsonc
 * - Project config: .gemini/omg.jsonc
 * - Environment variables
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { getConfigDir } from "../utils/paths.js";
import { parseJsonc } from "../utils/jsonc.js";
import { getDefaultTierModels, BUILTIN_EXTERNAL_MODEL_DEFAULTS, isNonGeminiProvider, } from "./models.js";
/**
 * Default configuration.
 *
 * Model IDs are resolved from environment variables (OMG_MODEL_HIGH,
 * OMG_MODEL_MEDIUM, OMG_MODEL_LOW) with built-in fallbacks.
 * User/project config files can further override via deepMerge.
 *
 * Note: env vars for external model defaults (OMG_GEMINI_DEFAULT_MODEL,
 * OMG_GEMINI_DEFAULT_MODEL) are read lazily in loadEnvConfig() to avoid
 * capturing stale values at module load time.
 */
export function buildDefaultConfig() {
    const defaultTierModels = getDefaultTierModels();
    return {
        agents: {
            omg: { model: defaultTierModels.HIGH },
            explore: { model: defaultTierModels.LOW },
            analyst: { model: defaultTierModels.HIGH },
            planner: { model: defaultTierModels.HIGH },
            architect: { model: defaultTierModels.HIGH },
            debugger: { model: defaultTierModels.MEDIUM },
            executor: { model: defaultTierModels.MEDIUM },
            verifier: { model: defaultTierModels.MEDIUM },
            securityReviewer: { model: defaultTierModels.MEDIUM },
            codeReviewer: { model: defaultTierModels.HIGH },
            testEngineer: { model: defaultTierModels.MEDIUM },
            designer: { model: defaultTierModels.MEDIUM },
            writer: { model: defaultTierModels.LOW },
            qaTester: { model: defaultTierModels.MEDIUM },
            scientist: { model: defaultTierModels.MEDIUM },
            tracer: { model: defaultTierModels.MEDIUM },
            gitMaster: { model: defaultTierModels.MEDIUM },
            codeSimplifier: { model: defaultTierModels.HIGH },
            critic: { model: defaultTierModels.HIGH },
            documentSpecialist: { model: defaultTierModels.MEDIUM },
        },
        features: {
            parallelExecution: true,
            lspTools: true, // Real LSP integration with language servers
            astTools: true, // Real AST tools using ast-grep
            continuationEnforcement: true,
            autoContextInjection: true,
        },
        mcpServers: {
            exa: { enabled: true },
            context7: { enabled: true },
        },
        permissions: {
            allowBash: true,
            allowEdit: true,
            allowWrite: true,
            maxBackgroundTasks: 5,
        },
        magicKeywords: {
            ultrawork: ["ultrawork", "ulw", "uw"],
            search: ["search", "find", "locate"],
            analyze: ["analyze", "investigate", "examine"],
            ultrathink: ["ultrathink", "think", "reason", "ponder"],
        },
        // Intelligent model routing configuration
        routing: {
            enabled: true,
            defaultTier: "MEDIUM",
            forceInherit: false,
            escalationEnabled: true,
            maxEscalations: 2,
            tierModels: { ...defaultTierModels },
            agentOverrides: {
                architect: {
                    tier: "HIGH",
                    reason: "Advisory agent requires deep reasoning",
                },
                planner: {
                    tier: "HIGH",
                    reason: "Strategic planning requires deep reasoning",
                },
                critic: {
                    tier: "HIGH",
                    reason: "Critical review requires deep reasoning",
                },
                analyst: {
                    tier: "HIGH",
                    reason: "Pre-planning analysis requires deep reasoning",
                },
                explore: { tier: "LOW", reason: "Exploration is search-focused" },
                writer: { tier: "LOW", reason: "Documentation is straightforward" },
            },
            escalationKeywords: [
                "critical",
                "production",
                "urgent",
                "security",
                "breaking",
                "architecture",
                "refactor",
                "redesign",
                "root cause",
            ],
            simplificationKeywords: [
                "find",
                "list",
                "show",
                "where",
                "search",
                "locate",
                "grep",
            ],
        },
        // External models configuration (Gemini, Gemini)
        // Static defaults only — env var overrides applied in loadEnvConfig()
        externalModels: {
            defaults: {
                geminiModelId: BUILTIN_EXTERNAL_MODEL_DEFAULTS.geminiModelId,
            },
            fallbackPolicy: {
                onModelFailure: "provider_chain",
                allowCrossProvider: false,
                crossProviderOrder: ["gemini"],
            },
        },
        // Delegation routing configuration (opt-in feature for external model routing)
        delegationRouting: {
            enabled: false,
            defaultProvider: "gemini",
            roles: {},
        },
        planOutput: {
            directory: ".omg/plans",
            filenameTemplate: "{{name}}.md",
        },
        startupCodebaseMap: {
            enabled: true,
            maxFiles: 200,
            maxDepth: 4,
        },
        taskSizeDetection: {
            enabled: true,
            smallWordLimit: 50,
            largeWordLimit: 200,
            suppressHeavyModesForSmallTasks: true,
        },
    };
}
export const DEFAULT_CONFIG = buildDefaultConfig();
/**
 * Configuration file locations
 */
export function getConfigPaths() {
    const userConfigDir = getConfigDir();
    return {
        user: join(userConfigDir, "gemini-omg", "config.jsonc"),
        project: join(process.cwd(), ".gemini", "omg.jsonc"),
    };
}
/**
 * Load and parse a JSONC file
 */
export function loadJsoncFile(path) {
    if (!existsSync(path)) {
        return null;
    }
    try {
        const content = readFileSync(path, "utf-8");
        const result = parseJsonc(content);
        return result;
    }
    catch (error) {
        console.error(`Error loading config from ${path}:`, error);
        return null;
    }
}
/**
 * Deep merge two objects
 */
export function deepMerge(target, source) {
    const result = { ...target };
    const mutableResult = result;
    for (const key of Object.keys(source)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype")
            continue;
        const sourceValue = source[key];
        const targetValue = mutableResult[key];
        if (sourceValue !== undefined &&
            typeof sourceValue === "object" &&
            sourceValue !== null &&
            !Array.isArray(sourceValue) &&
            typeof targetValue === "object" &&
            targetValue !== null &&
            !Array.isArray(targetValue)) {
            mutableResult[key] = deepMerge(targetValue, sourceValue);
        }
        else if (sourceValue !== undefined) {
            mutableResult[key] = sourceValue;
        }
    }
    return result;
}
/**
 * Load configuration from environment variables
 */
export function loadEnvConfig() {
    const config = {};
    // MCP API keys
    if (process.env.EXA_API_KEY) {
        config.mcpServers = {
            ...config.mcpServers,
            exa: { enabled: true, apiKey: process.env.EXA_API_KEY },
        };
    }
    // Feature flags from environment
    if (process.env.OMG_PARALLEL_EXECUTION !== undefined) {
        config.features = {
            ...config.features,
            parallelExecution: process.env.OMG_PARALLEL_EXECUTION === "true",
        };
    }
    if (process.env.OMG_LSP_TOOLS !== undefined) {
        config.features = {
            ...config.features,
            lspTools: process.env.OMG_LSP_TOOLS === "true",
        };
    }
    if (process.env.OMG_MAX_BACKGROUND_TASKS) {
        const maxTasks = parseInt(process.env.OMG_MAX_BACKGROUND_TASKS, 10);
        if (!isNaN(maxTasks)) {
            config.permissions = {
                ...config.permissions,
                maxBackgroundTasks: maxTasks,
            };
        }
    }
    // Routing configuration from environment
    if (process.env.OMG_ROUTING_ENABLED !== undefined) {
        config.routing = {
            ...config.routing,
            enabled: process.env.OMG_ROUTING_ENABLED === "true",
        };
    }
    if (process.env.OMG_ROUTING_FORCE_INHERIT !== undefined) {
        config.routing = {
            ...config.routing,
            forceInherit: process.env.OMG_ROUTING_FORCE_INHERIT === "true",
        };
    }
    if (process.env.OMG_ROUTING_DEFAULT_TIER) {
        const tier = process.env.OMG_ROUTING_DEFAULT_TIER.toUpperCase();
        if (tier === "LOW" || tier === "MEDIUM" || tier === "HIGH") {
            config.routing = {
                ...config.routing,
                defaultTier: tier,
            };
        }
    }
    // Model alias overrides from environment (issue #1211)
    const aliasKeys = ["FLASH", "PRO", "ULTRA"];
    const modelAliases = {};
    for (const key of aliasKeys) {
        const envVal = process.env[`OMG_MODEL_ALIAS_${key}`];
        if (envVal) {
            const lower = key.toLowerCase();
            modelAliases[lower] = envVal.toLowerCase();
        }
    }
    if (Object.keys(modelAliases).length > 0) {
        config.routing = {
            ...config.routing,
            modelAliases: modelAliases,
        };
    }
    if (process.env.OMG_ESCALATION_ENABLED !== undefined) {
        config.routing = {
            ...config.routing,
            escalationEnabled: process.env.OMG_ESCALATION_ENABLED === "true",
        };
    }
    // External models configuration from environment
    const externalModelsDefaults = {};
    if (process.env.OMG_EXTERNAL_MODELS_DEFAULT_PROVIDER) {
        const provider = process.env.OMG_EXTERNAL_MODELS_DEFAULT_PROVIDER;
        if (provider === "gemini" || provider === "gemini") {
            externalModelsDefaults.provider = provider;
        }
    }
    if (process.env.OMG_EXTERNAL_MODELS_DEFAULT_ANTHROPIC_MODEL) {
        externalModelsDefaults.geminiModelId =
            process.env.OMG_EXTERNAL_MODELS_DEFAULT_ANTHROPIC_MODEL;
    }
    else if (process.env.OMG_GEMINI_DEFAULT_MODEL) {
        // Legacy fallback
        externalModelsDefaults.geminiModelId = process.env.OMG_GEMINI_DEFAULT_MODEL;
    }
    const externalModelsFallback = {
        onModelFailure: "provider_chain",
    };
    if (process.env.OMG_EXTERNAL_MODELS_FALLBACK_POLICY) {
        const policy = process.env.OMG_EXTERNAL_MODELS_FALLBACK_POLICY;
        if (policy === "provider_chain" ||
            policy === "cross_provider" ||
            policy === "gemini_only") {
            externalModelsFallback.onModelFailure = policy;
        }
    }
    // Only add externalModels if any env vars were set
    if (Object.keys(externalModelsDefaults).length > 0 ||
        externalModelsFallback.onModelFailure !== "provider_chain") {
        config.externalModels = {
            defaults: externalModelsDefaults,
            fallbackPolicy: externalModelsFallback,
        };
    }
    // Delegation routing configuration from environment
    if (process.env.OMG_DELEGATION_ROUTING_ENABLED !== undefined) {
        config.delegationRouting = {
            ...config.delegationRouting,
            enabled: process.env.OMG_DELEGATION_ROUTING_ENABLED === "true",
        };
    }
    if (process.env.OMG_DELEGATION_ROUTING_DEFAULT_PROVIDER) {
        const provider = process.env.OMG_DELEGATION_ROUTING_DEFAULT_PROVIDER;
        if (["gemini", "gemini", "gemini"].includes(provider)) {
            config.delegationRouting = {
                ...config.delegationRouting,
                defaultProvider: provider,
            };
        }
    }
    return config;
}
/**
 * Load and merge all configuration sources
 */
export function loadConfig() {
    const paths = getConfigPaths();
    // Start with fresh defaults so env-based model overrides are resolved at call time
    let config = buildDefaultConfig();
    // Merge user config
    const userConfig = loadJsoncFile(paths.user);
    if (userConfig) {
        config = deepMerge(config, userConfig);
    }
    // Merge project config (takes precedence over user)
    const projectConfig = loadJsoncFile(paths.project);
    if (projectConfig) {
        config = deepMerge(config, projectConfig);
    }
    // Merge environment variables (highest precedence)
    const envConfig = loadEnvConfig();
    config = deepMerge(config, envConfig);
    // Auto-enable forceInherit for non-standard providers (issues #1201, #1025)
    // Only auto-enable if user hasn't explicitly set it via config or env var.
    // Triggers for: CC Switch / LiteLLM (non-Gemini model IDs), custom
    // ANTHROPIC_BASE_URL, AWS Bedrock (GEMINI_CODE_USE_BEDROCK=1), and
    // Google Vertex AI (GEMINI_CODE_USE_VERTEX=1). Passing Gemini-specific
    // tier names (pro/ultra/flash) causes 400 errors on these platforms.
    if (config.routing?.forceInherit !== true &&
        process.env.OMG_ROUTING_FORCE_INHERIT === undefined &&
        isNonGeminiProvider()) {
        config.routing = {
            ...config.routing,
            forceInherit: true,
        };
    }
    return config;
}
const OMG_STARTUP_COMPACTABLE_SECTIONS = [
    "agent_catalog",
    "skills",
    "team_compositions",
];
function looksLikeOmgGuidance(content) {
    return (content.includes("<guidance_schema_contract>") &&
        /oh-my-(gemini-cli|gemini)/i.test(content) &&
        OMG_STARTUP_COMPACTABLE_SECTIONS.some((section) => content.includes(`<${section}>`) && content.includes(`</${section}>`)));
}
export function compactOmgStartupGuidance(content) {
    if (!looksLikeOmgGuidance(content)) {
        return content;
    }
    let compacted = content;
    let removedAny = false;
    for (const section of OMG_STARTUP_COMPACTABLE_SECTIONS) {
        const pattern = new RegExp(`\n*<${section}>[\\s\\S]*?<\/${section}>\n*`, "g");
        const next = compacted.replace(pattern, "\n\n");
        removedAny = removedAny || next !== compacted;
        compacted = next;
    }
    if (!removedAny) {
        return content;
    }
    return compacted
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n\n---\n\n---\n\n/g, "\n\n---\n\n")
        .trim();
}
/**
 * Find and load AGENTS.md or GEMINI.md files for context injection
 */
export function findContextFiles(startDir) {
    const files = [];
    const searchDir = startDir ?? process.cwd();
    // Files to look for
    const contextFileNames = [
        "AGENTS.md",
        "GEMINI.md",
        ".gemini/GEMINI.md",
        ".gemini/AGENTS.md",
    ];
    // Search in current directory and parent directories
    let currentDir = searchDir;
    const searchedDirs = new Set();
    while (currentDir && !searchedDirs.has(currentDir)) {
        searchedDirs.add(currentDir);
        for (const fileName of contextFileNames) {
            const filePath = join(currentDir, fileName);
            if (existsSync(filePath) && !files.includes(filePath)) {
                files.push(filePath);
            }
        }
        const parentDir = dirname(currentDir);
        if (parentDir === currentDir)
            break;
        currentDir = parentDir;
    }
    return files;
}
/**
 * Load context from AGENTS.md/GEMINI.md files
 */
export function loadContextFromFiles(files) {
    const contexts = [];
    for (const file of files) {
        try {
            const content = compactOmgStartupGuidance(readFileSync(file, "utf-8"));
            contexts.push(`## Context from ${file}\n\n${content}`);
        }
        catch (error) {
            console.warn(`Warning: Could not read context file ${file}:`, error);
        }
    }
    return contexts.join("\n\n---\n\n");
}
/**
 * Generate JSON Schema for configuration (for editor autocomplete)
 */
export function generateConfigSchema() {
    return {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "Oh-My-GeminiCode Configuration",
        type: "object",
        properties: {
            agents: {
                type: "object",
                description: "Agent model and feature configuration",
                properties: {
                    omg: {
                        type: "object",
                        properties: {
                            model: {
                                type: "string",
                                description: "Model ID for the main orchestrator",
                            },
                        },
                    },
                    explore: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    analyst: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    planner: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    architect: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    debugger: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    executor: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    verifier: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    securityReviewer: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    codeReviewer: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    testEngineer: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    designer: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    writer: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    qaTester: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    scientist: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    tracer: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    gitMaster: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    codeSimplifier: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    critic: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                    documentSpecialist: {
                        type: "object",
                        properties: { model: { type: "string" } },
                    },
                },
            },
            features: {
                type: "object",
                description: "Feature toggles",
                properties: {
                    parallelExecution: { type: "boolean", default: true },
                    lspTools: { type: "boolean", default: true },
                    astTools: { type: "boolean", default: true },
                    continuationEnforcement: { type: "boolean", default: true },
                    autoContextInjection: { type: "boolean", default: true },
                },
            },
            mcpServers: {
                type: "object",
                description: "MCP server configurations",
                properties: {
                    exa: {
                        type: "object",
                        properties: {
                            enabled: { type: "boolean" },
                            apiKey: { type: "string" },
                        },
                    },
                    context7: {
                        type: "object",
                        properties: { enabled: { type: "boolean" } },
                    },
                },
            },
            permissions: {
                type: "object",
                description: "Permission settings",
                properties: {
                    allowBash: { type: "boolean", default: true },
                    allowEdit: { type: "boolean", default: true },
                    allowWrite: { type: "boolean", default: true },
                    maxBackgroundTasks: {
                        type: "integer",
                        default: 5,
                        minimum: 1,
                        maximum: 50,
                    },
                },
            },
            magicKeywords: {
                type: "object",
                description: "Magic keyword triggers",
                properties: {
                    ultrawork: { type: "array", items: { type: "string" } },
                    search: { type: "array", items: { type: "string" } },
                    analyze: { type: "array", items: { type: "string" } },
                    ultrathink: { type: "array", items: { type: "string" } },
                },
            },
            routing: {
                type: "object",
                description: "Intelligent model routing configuration",
                properties: {
                    enabled: {
                        type: "boolean",
                        default: true,
                        description: "Enable intelligent model routing",
                    },
                    defaultTier: {
                        type: "string",
                        enum: ["LOW", "MEDIUM", "HIGH"],
                        default: "MEDIUM",
                        description: "Default tier when no rules match",
                    },
                    forceInherit: {
                        type: "boolean",
                        default: false,
                        description: "Force all agents to inherit the parent model, bypassing OMG model routing. When true, no model parameter is passed to Task/Agent calls, so agents use the user's Gemini Code model setting. Auto-enabled for non-Gemini providers (CC Switch, custom ANTHROPIC_BASE_URL), AWS Bedrock, and Google Vertex AI.",
                    },
                },
            },
            externalModels: {
                type: "object",
                description: "External model provider configuration (Gemini, Gemini)",
                properties: {
                    defaults: {
                        type: "object",
                        description: "Default model settings for external providers",
                        properties: {
                            provider: {
                                type: "string",
                                enum: ["gemini", "gemini"],
                                description: "Default external provider",
                            },
                            geminiModelId: {
                                type: "string",
                                default: BUILTIN_EXTERNAL_MODEL_DEFAULTS.geminiModelId,
                                description: "Default Gemini model",
                            },
                        },
                    },
                    rolePreferences: {
                        type: "object",
                        description: "Provider/model preferences by agent role",
                        additionalProperties: {
                            type: "object",
                            properties: {
                                provider: { type: "string", enum: ["gemini", "gemini"] },
                                model: { type: "string" },
                            },
                            required: ["provider", "model"],
                        },
                    },
                    taskPreferences: {
                        type: "object",
                        description: "Provider/model preferences by task type",
                        additionalProperties: {
                            type: "object",
                            properties: {
                                provider: { type: "string", enum: ["gemini", "gemini"] },
                                model: { type: "string" },
                            },
                            required: ["provider", "model"],
                        },
                    },
                    fallbackPolicy: {
                        type: "object",
                        description: "Fallback behavior on model failure",
                        properties: {
                            onModelFailure: {
                                type: "string",
                                enum: ["provider_chain", "cross_provider", "gemini_only"],
                                default: "provider_chain",
                                description: "Fallback strategy when a model fails",
                            },
                            allowCrossProvider: {
                                type: "boolean",
                                default: false,
                                description: "Allow fallback to a different provider",
                            },
                            crossProviderOrder: {
                                type: "array",
                                items: { type: "string", enum: ["gemini", "gemini"] },
                                default: ["gemini", "gemini"],
                                description: "Order of providers for cross-provider fallback",
                            },
                        },
                    },
                },
            },
            delegationRouting: {
                type: "object",
                description: "Delegation routing configuration for external model providers (opt-in feature)",
                properties: {
                    enabled: {
                        type: "boolean",
                        default: false,
                        description: "Enable delegation routing to external providers (Gemini, Gemini)",
                    },
                    defaultProvider: {
                        type: "string",
                        enum: ["gemini", "gemini", "gemini"],
                        default: "gemini",
                        description: "Default provider for delegation routing when no specific role mapping exists",
                    },
                    roles: {
                        type: "object",
                        description: "Provider mappings by agent role",
                        additionalProperties: {
                            type: "object",
                            properties: {
                                provider: {
                                    type: "string",
                                    enum: ["gemini", "gemini", "gemini"],
                                },
                                tool: { type: "string", enum: ["Task"] },
                                model: { type: "string" },
                                agentType: { type: "string" },
                                fallback: { type: "array", items: { type: "string" } },
                            },
                            required: ["provider", "tool"],
                        },
                    },
                },
            },
        },
    };
}
//# sourceMappingURL=loader.js.map