import { FullTartanContext } from "./tartan-context.js";

export type NodeType =
    | "page"
    | "page.file"
    | "asset"
    | "handoff"
    | "handoff.file";

export type ContextTreeNode<T extends NodeType = NodeType> = {
    /**
     * The unique ID of this node.
     */
    id: string;
    /**
     * The type of this node.
     */
    type: T;
    /**
     * The path, relative to the root of the source directory, that this node is located at.
     * May be a directory or a file, depending on the node's type.
     */
    path: string;
    /**
     * The local context object for this node.
     */
    context: FullTartanContext;
    /**
     * The inheritable context object, for child nodes to inherit from.
     */
    inheritableContext: FullTartanContext;
    children: ContextTreeNode[];
    /**
     * The directory in which this node's sources are written to before being outputted.
     */
    stagingDirectory: string;
};

export type ProcessedNode = {
    /**
     * The unique ID of this node
     */
    id: string;
    /**
     * The path of this node, relative to the root directory.
     */
    path: string;
    /**
     * The type of the node.
     */
    type: NodeType;
    /**
     * The output path defined by source processors (which will be relative to the parent's output path)
     */
    outputPath: string | undefined;
    /**
     * The directory in which this node's sources are written to before being outputted.
     */
    stagingDirectory: string;
    /**
     * The node's local context object
     */
    context: FullTartanContext;
    /**
     * The node's inheritable context object
     */
    inheritableContext: FullTartanContext;
    /**
     * Arbitrary metadata provided by the source processors or handoff handler
     */
    metadata: { [key: string]: any };
    /**
     * Child nodes that existed before processing.
     */
    baseChildren: ProcessedNode[];
    /**
     * Child nodes that were discovered during processing.
     */
    derivedChildren: ProcessedNode[];
};

export type ResolvedNode = Omit<
    ProcessedNode,
    "outputPath" | "baseChildren" | "derivedChildren"
> & {
    /**
     * The fully resolved output path of this node, relative to the root output directory
     */
    outputPath: string;
    /**
     * Child nodes that existed before processing.
     */
    baseChildren: ResolvedNode[];
    /**
     * Child nodes that were discovered during processing.
     */
    derivedChildren: ResolvedNode[];
};
