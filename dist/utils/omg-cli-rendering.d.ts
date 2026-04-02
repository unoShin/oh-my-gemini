export interface OmgCliRenderOptions {
    env?: NodeJS.ProcessEnv;
    omgAvailable?: boolean;
}
export declare function resolveOmgCliPrefix(options?: OmgCliRenderOptions): string;
export declare function formatOmgCliInvocation(commandSuffix: string, options?: OmgCliRenderOptions): string;
export declare function rewriteOmgCliInvocations(text: string, options?: OmgCliRenderOptions): string;
//# sourceMappingURL=omg-cli-rendering.d.ts.map