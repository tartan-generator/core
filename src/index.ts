import { loadContextTreeNode } from "./phases/discovery.js";
import { finalizeNode } from "./phases/finalizing.js";
import { outputNode } from "./phases/output.js";
import { processNode } from "./phases/processing.js";
import { resolveNode } from "./phases/resolving.js";
import { ContextTreeNode, ProcessedNode, ResolvedNode } from "./types/nodes.js";
import { FullTartanContext } from "./types/tartan-context.js";

/**
 * A helper function that calls each phase in sequence and returns the root ResolvedNode
 *
 * @argument sourceDirectory The directory to load the root node from (will be loaded as a page)
 * @argument outputDirectory The directory to output the generated site to.
 * @argument rootContext The context for nodes to inherit from if not their parent.
 */
export async function build(
    sourceDirectory: string,
    outputDirectory: string,
    rootContext: FullTartanContext,
): Promise<ResolvedNode> {
    const node: ContextTreeNode = await loadContextTreeNode({
        directory: sourceDirectory,
        rootContext: rootContext,
    });
    const processed: ProcessedNode = await processNode({
        node,
        rootContext: rootContext,
        sourceDirectory: sourceDirectory,
    });
    const resolved: ResolvedNode = resolveNode(processed);
    const finalized: ResolvedNode = await finalizeNode({
        node: resolved,
        sourceDirectory: sourceDirectory,
    });

    const outputted = await outputNode(finalized, outputDirectory);

    return outputted;
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

// Other stuff to assist UIs
export * from "./logger.js"; // so that clients of the core utils can share the logger
export { loadObject } from "./inputs/file-object.js"; // to load config and stuff
export { initializeContext } from "./inputs/context.js"; // to initialize root context
