/*
 * This is just a slightly modified copy of `processNode`
 */
import { HandoffHandler } from "../types/handoff-handler.js";
import { TartanInput } from "../types/inputs.js";
import { ResolvedNode } from "../types/nodes.js";
import fs from "fs/promises";
import { resolvePath } from "../inputs/resolve.js";
import path from "path";
import {
    SourceFinalizerInput,
    SourceFinalizerOutput,
    SourceProcessor,
} from "../types/source-processor.js";
import { minimatch } from "minimatch";
import { buffer } from "stream/consumers";
import { Readable } from "stream";
import { URL } from "node:url";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Logger, LogLevel } from "../logger.js";

export async function finalizeNode(params: {
    node: ResolvedNode;
    rootNode?: ResolvedNode;
    rootDirectory: string;
}): Promise<ResolvedNode> {
    const { node, rootNode = node, rootDirectory } = params;
    Logger.log(`Finalizing node ${node.id} at ${node.path}`, LogLevel.Info);

    if (node.type === "handoff" || node.type === "handoff.file") {
        Logger.log(
            `Node ${node.id} at ${node.path} is "handoff" type`,
            LogLevel.Verbose,
        );
        if (node.context.handoffHandler === undefined) {
            throw `No handoff handler object for handoff node ${node.id} at ${node.path}`;
        }
        const handoffHandler: HandoffHandler =
            node.context.handoffHandler.value;

        // Execute handoff handler
        Logger.log(
            `Executing handoff handler (${node.context.handoffHandler.url.pathname}) for node ${node.id}:${node.path}`,
            LogLevel.Verbose,
        );
        if (handoffHandler.finalize) {
            await handoffHandler.finalize({
                extraContext: node.context.extraContext,
                extraParameters: node.context.handoffHandler.url.searchParams,
                nodePath: node.path,
                stagingDirectory: node.stagingDirectory,
                isFile: node.type === "handoff.file",
                outputPath: node.outputPath,
                isRoot: node === rootNode,
                thisNode: node,
                rootNode: rootNode,
            });
        }
    } else {
        // find the source processor list to use
        let sourceProcessors: TartanInput<SourceProcessor>[];
        if (node.type === "page" || node.type === "page.file") {
            sourceProcessors = node.context.sourceProcessors ?? [];
        } else if (node.type === "asset") {
            sourceProcessors =
                Object.entries(node.context.assetProcessors ?? {}).find(
                    ([glob]) => minimatch(node.path, glob),
                )?.[1] ?? [];
        } else {
            throw `invalid node type "${node.type}" for node ${node.id} at ${node.path}`;
        }

        // set up the source file path
        let filepath: URL;
        if (node.type === "page") {
            filepath = resolvePath(
                node.context.pageSource!,
                path.resolve(node.path, rootDirectory),
                {
                    "~root": rootDirectory,
                },
            );
        } else if (node.type === "page.file" || node.type === "asset") {
            filepath = resolvePath(node.path, rootDirectory, {
                "~root": rootDirectory,
            });
        } else {
            throw `invalid node type "${node.type}" for node ${node.id} at ${node.path}`;
        }

        /*
         * Set up all the transient params (passed from processor to processor)
         */
        const cumulative = {
            getSourceBuffer: (() =>
                fs.readFile(
                    path.join(node.stagingDirectory, "processed"),
                )) as SourceFinalizerInput["getSourceBuffer"],
            getSourceStream: (() =>
                fs
                    .open(path.join(node.stagingDirectory, "processed"))
                    .then((handle) =>
                        handle.createReadStream(),
                    )) as SourceFinalizerInput["getSourceStream"],
        };

        /*
         * Run all the source processors
         */
        for (const processor of sourceProcessors) {
            if (processor.value.finalize) {
                const output: SourceFinalizerOutput =
                    await processor.value.finalize({
                        getSourceBuffer: cumulative.getSourceBuffer,
                        getSourceStream: cumulative.getSourceStream,
                        extraContext: node.context.extraContext,
                        pathParameters: processor.url.searchParams,
                        sourceMetadata: node.metadata,
                        sourcePath: filepath.pathname,
                        outputPath: node.outputPath,
                        isRoot: node === rootNode,
                        thisNode: node,
                        rootNode: rootNode,
                    });

                // update transient params again
                const contents = output;
                cumulative.getSourceBuffer =
                    contents instanceof Buffer
                        ? async () => contents
                        : async () => buffer(contents as Readable);
                cumulative.getSourceStream =
                    contents instanceof Readable
                        ? async () => contents
                        : async () => Readable.from(contents as Buffer);
            }
        }

        // write to output file
        // note: I considered using fs.copyFile if there were no source processors,
        // but that shouldn't drastically improve performance, and I feel like this is more maintainable.
        await pipeline(
            await cumulative.getSourceStream(),
            createWriteStream(path.join(node.stagingDirectory, "finalized")),
        );
    }

    await Promise.all(
        node.baseChildren
            .concat(node.derivedChildren)
            .map((child) =>
                finalizeNode({ node: child, rootDirectory, rootNode }),
            ),
    );
    return node;
}
