import TransportStream from "winston-transport";
import { loadContextTreeNode } from "./phases/discovery.js";
import { finalizeNode } from "./phases/finalizing.js";
import { outputNode } from "./phases/output.js";
import { processNode } from "./phases/processing.js";
import { resolveNode } from "./phases/resolving.js";
import {
    ContextTreeNode,
    FinalizedNode,
    OutputtedNode,
    ProcessedNode,
    ResolvedNode,
} from "./types/nodes.js";
import { FullTartanContext } from "./types/tartan-context.js";
import { createLogger } from "winston";
import { NullTransport } from "./types/logs.js";

export type BuildResult = {
    discovered: BuiltPhase<ContextTreeNode>;
    processed: BuiltPhase<ProcessedNode>;
    resolved: BuiltPhase<ResolvedNode>;
    finalized: BuiltPhase<FinalizedNode>;
    outputted: BuiltPhase<OutputtedNode>;
};

export type TartanConfig = {
    /**
     * The directory to load the root node from (will be loaded as a page)
     */
    sourceDirectory: string;
    /**
     * The directory to output the generated site to.
     */
    outputDirectory: string;
    /**
     * The context object for nodes to inherit from if not their parent.
     */
    rootContext: FullTartanContext;
};

/**
 * A helper function that calls each phase in sequence and returns the root ResolvedNode
 *
 * @argument sourceDirectory The directory to load the root node from (will be loaded as a page)
 * @argument outputDirectory The directory to output the generated site to.
 * @argument rootContext The context for nodes to inherit from if not their parent.
 */
export async function build(
    config: TartanConfig,
    /**
     * Tranports for winston logs. If not provided,
     */
    loggerTransports?: TransportStream[],
): Promise<BuildResult> {
    const { sourceDirectory, outputDirectory, rootContext } = config;
    const baseLogger = createLogger({
        transports: loggerTransports ?? [new NullTransport()],
    });
    const node: ContextTreeNode = await loadContextTreeNode({
        directory: sourceDirectory,
        rootContext: rootContext,
        baseLogger,
    });
    const processed: ProcessedNode = await processNode({
        node,
        rootContext: rootContext,
        sourceDirectory: sourceDirectory,
        baseLogger,
    });
    const resolved: ResolvedNode = resolveNode(processed);
    const finalized: FinalizedNode = await finalizeNode({
        node: resolved,
        sourceDirectory: sourceDirectory,
    });

    const outputted = await outputNode(finalized, outputDirectory);

    return {
        discovered: {
            tree: node,
            serialized: JSON.stringify(node),
        },
        processed: {
            tree: processed,
            serialized: JSON.stringify(processed),
        },
        resolved: {
            tree: resolved,
            serialized: JSON.stringify(resolved),
        },
        finalized: {
            tree: finalized,
            serialized: JSON.stringify(finalized),
        },
        outputted: {
            tree: outputted,
            serialized: JSON.stringify(outputted),
        },
    };
}

// Export all the phases
export { finalizeNode } from "./phases/finalizing.js";
export { outputNode } from "./phases/output.js";
export { processNode } from "./phases/processing.js";
export { resolveNode } from "./phases/resolving.js";
export { loadContextTreeNode } from "./phases/discovery.js";

// Export all the types
export * from "./types/handoff-handler.js";
export * from "./types/source-processor.js";
export * from "./types/tartan-context.js";
export * from "./types/nodes.js";
export * from "./types/inputs.js";
export * from "./types/logs.js";
export * from "./types/serialized.js";

// Other stuff to assist UIs
export { loadObject } from "./inputs/file-object.js"; // to load config and stuff
export { initializeContext } from "./inputs/context.js"; // to initialize root context
