import { TartanInput } from "./inputs.js";
import {
    ContextTreeNode,
    ProcessedNode,
    ResolvedNode,
    FinalizedNode,
    OutputtedNode,
} from "./nodes.js";
import { SourceProcessor } from "./source-processor.js";
import { HandoffHandler } from "./handoff-handler.js";
import { FullTartanContext } from "./tartan-context.js";
import { ReplaceTypes } from "./util.js";

export type SerializedTartanInput<T> = Omit<TartanInput<T>, "value" | "url"> & {
    url: string;
};
export type SerializedContext = ReplaceTypes<
    FullTartanContext,
    {
        sourceProcessors?: SerializedTartanInput<SourceProcessor>[];
        handoffHandler?: SerializedTartanInput<HandoffHandler>;
        assetProcessors?: {
            [key: string]: SerializedTartanInput<SourceProcessor>[];
        };
    }
>;

export type SerializedContextTreeNode = Omit<
    ContextTreeNode,
    "logger" | "sourcePath" | "context" | "inheritableContext" | "children"
> & {
    sourcePath: string | undefined;
    context: SerializedContext;
    inheritableContext: SerializedContext;
    children: SerializedContextTreeNode[];
};

export type SerializedProcessedNode = ReplaceTypes<
    Omit<ProcessedNode, "logger">,
    {
        sourcePath: string | undefined;
        context: SerializedContext;
        inheritableContext: SerializedContext;
        children: SerializedProcessedNode[];
    }
>;

export type SerializedResolvedNode = ReplaceTypes<
    Omit<ResolvedNode, "logger">,
    {
        sourcePath: string | undefined;
        context: SerializedContext;
        inheritableContext: SerializedContext;
        children: SerializedResolvedNode[];
    }
>;

export type SerializedFinalizedNode = ReplaceTypes<
    Omit<FinalizedNode, "logger">,
    {
        sourcePath: string | undefined;
        context: SerializedContext;
        inheritableContext: SerializedContext;
        children: SerializedResolvedNode[];
    }
>;

export type SerializedOutputtedNode = ReplaceTypes<
    Omit<OutputtedNode, "logger">,
    {
        sourcePath: string | undefined;
        context: SerializedContext;
        inheritableContext: SerializedContext;
        children: SerializedResolvedNode[];
    }
>;
