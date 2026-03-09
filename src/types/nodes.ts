import { Logger } from "winston";
import { FullTartanContext } from "./tartan-context.js";

export type NodeType =
    | "page"
    | "page.file"
    | "asset"
    | "handoff"
    | "handoff.file"
    | "container";

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
     * The path this node is located at, relative to the source directory.
     * May be a directory or a file, depending on the node's type.
     */
    path: string;
    /**
     * The path to load for this node's source.
     * It is not guaranteed that this path will actually exist on disk in the case of handoff or container nodes.
     * Will always point to a file.
     */
    sourcePath: URL | undefined;
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
    /**
     * The logger object for this node.
     */
    logger: Logger;
};

export type ProcessedNode = {
    /**
     * The unique ID of this node
     */
    id: string;
    /**
     * The path of this node, relative to the source directory.
     */
    path: string;
    /**
     * Whether this node is a `derived node`.
     */
    derived: boolean;
    /**
     * The path to load for this node's source.
     * It is not guaranteed that this path will actually exist on disk in the case of handoff or container nodes.
     * Will always point to a file.
     */
    sourcePath: URL | undefined;
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
     * This node's children, both derived and base.
     */
    children: ProcessedNode[];
    /**
     * The logger object for this node.
     */
    logger: Logger;
};

export type ResolvedNode = Omit<ProcessedNode, "outputPath" | "children"> & {
    /**
     * The fully resolved output path of this node, relative to the output directory
     */
    outputPath: string;
    children: ResolvedNode[];
};

export type OutputtedNode = {
    /**
     * The path of this fs object, relative to the base output directory
     */
    path: string;
    type: "directory" | "file";
    children: OutputtedNode[];
    /**
     * The size, in bytes, of the output (if it was a file)
     */
    size?: number;
};
