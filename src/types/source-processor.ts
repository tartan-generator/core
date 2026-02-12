import { Readable } from "stream";
import { ProcessedNode } from "../types/nodes.js";
import { FullTartanContext } from "./tartan-context.js";
import { ResolvedNode } from "./nodes.js";
import { URLSearchParams } from "node:url";

export type SourceProcessor = {
    process?: (input: SourceProcessorInput) => Promise<SourceProcessorOutput>;
    finalize?: (input: SourceFinalizerInput) => Promise<SourceFinalizerOutput>;
};

export type SourceProcessorInput = {
    /**
     * Get the source file as a buffer.
     */
    getSourceBuffer: () => Promise<Buffer>;
    /**
     * Get the source file as a readable stream.
     */
    getSourceStream: () => Promise<Readable>;
    /**
     * Extra context provided by the node's context object.
     */
    extraContext: FullTartanContext["extraContext"];
    /**
     * Parameters provided by the module specifier that pointed to this source processor.
     */
    pathParameters: URLSearchParams;
    /**
     * Metadata about the source, provided by other source processors.
     */
    sourceMetadata: {
        [key: string]: any;
    };
    /**
     * The location of the source file, relative to the root directory.
     */
    sourcePath: string;
    /**
     * The output path (relative to the parent node) as defined by previous source processors.
     */
    outputPath: string | undefined;
    /**
     * Whether or not this node is the root node, which will affect some behaviors (for example, changes to the output path will throw a warning and then be ignored).
     */
    isRoot: boolean;
    /**
     * Processed children.
     */
    children: ProcessedNode[];
    /**
     * The cumulative list of all dependencies specified by previous source processors
     */
    dependencies: string[];
};
export type SourceProcessorOutput = {
    /**
     * The processed contents.
     */
    processedContents: Buffer | Readable;
    /**
     * Any extra info about the source
     */
    sourceMetadata?: {
        [key: string]: any;
    };
    /**
     * Paths to load extra nodes from (referred to as "derived nodes").
     * These will all be loaded as `asset` type, although they might be switched to `handoff.file` depending on context.
     */
    dependencies?: string[];
    /**
     * The path (relative to the parent node) that this node should be outputted to.
     */
    outputPath?: string;
};

export type SourceFinalizerInput = Omit<
    SourceProcessorInput,
    "outputPath" | "children" | "dependencies"
> & {
    /**
     * The resolved output path, relative to the root of the output directory.
     */
    outputPath: string;
    /**
     * The processed and resolved node that's being post-processed.
     */
    thisNode: ResolvedNode;
    /**
     * The fully processed and resolved root node.
     */
    rootNode: ResolvedNode;
};
/**
 * Either a buffer or a readable stream to write the contents of to a file.
 */
export type SourceFinalizerOutput = Buffer | Readable;
