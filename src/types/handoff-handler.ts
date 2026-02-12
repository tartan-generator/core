import { URLSearchParams } from "node:url";
import { ResolvedNode } from "./nodes.js";
import { FullTartanContext } from "./tartan-context.js";

export type HandoffHandler = {
    process?: (input: HandoffHandlerInput) => Promise<HandoffHandlerOutput>;
    finalize?: (
        input: HandoffFinalizerInput,
    ) => Promise<HandoffFinalizerOutput>;
};

export type HandoffHandlerInput = {
    /**
     * Extra context provided by the node's context object.
     */
    extraContext: FullTartanContext["extraContext"];
    /**
     * Parameters provided by the module specifier that pointed to this handoff processor.
     */
    extraParameters: URLSearchParams;
    /**
     * The location of the node, relative to the root directory.
     */
    nodePath: string;
    /**
     * The path that content should be outputted to. This will *not* match the final output path, it's simply a staging directory.
     * Keep in mind that the file/directory that's actually copied to the output directory should be at {stagingDirectory}/finalized
     */
    stagingDirectory: string;
    /**
     * Whether or not this node is the root node, which will affect some behaviors (for example, changes to the output path will throw a warning and then be ignored).
     */
    isRoot: boolean;
    /**
     * Whether the node is a file or not
     */
    isFile: boolean;
};
export type HandoffHandlerOutput = {
    /**
     * Any extra info about the node
     */
    metadata?: {
        [key: string]: any;
    };
    /**
     * The path, relative to the parent node, that this node should be outputted to.
     */
    outputPath?: string;
};

export type HandoffFinalizerInput = HandoffHandlerInput & {
    /**
     * The resolved output path, relative to the root of the output directory.
     */
    outputPath: string;
    /**
     * The processed and resolved node that's being handed off.
     */
    thisNode: ResolvedNode;
    /**
     * The fully processed and resolved root node.
     */
    rootNode: ResolvedNode;
};
export type HandoffFinalizerOutput = void;
