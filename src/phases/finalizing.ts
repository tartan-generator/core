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

export async function finalizeNode(params: {
    node: ResolvedNode;
    rootNode?: ResolvedNode;
    sourceDirectory: string;
}): Promise<ResolvedNode> {
    const { node, rootNode = node, sourceDirectory } = params;
    const logger = node.logger.child({ phase: "finalizing" });
    logger.info(`starting the finalizing phase`);

    if (node.type === "handoff" || node.type === "handoff.file") {
        logger.debug(`Node is "handoff" type`);
        if (node.context.handoffHandler === undefined) {
            throw `No handoff handler object for handoff node ${node.id} at ${node.path}`;
        }
        const handoffHandler: HandoffHandler =
            node.context.handoffHandler.value;

        logger.debug(
            `handoff handler found at ${node.context.handoffHandler.url.pathname}`,
        );
        // Execute handoff handler
        logger.info(`Executing handoff handler`);
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
                logger,
            });
        }
    } else {
        // find the source processor list to use
        let sourceProcessors: TartanInput<SourceProcessor>[];
        if (node.type === "page" || node.type === "page.file") {
            logger.debug(
                `node is a page, using the regular source processor list`,
            );
            sourceProcessors = node.context.sourceProcessors ?? [];
        } else if (node.type === "asset") {
            logger.debug(
                "node is an asset, trying to match with an asset processor list",
            );
            const match = Object.entries(
                node.context.assetProcessors ?? {},
            ).find(([glob]) => minimatch(node.path, glob));
            if (match) {
                logger.debug(`matched glob ${match[0]}`);
                sourceProcessors = match[1];
            } else {
                logger.debug("no match found");
                sourceProcessors = [];
            }
        } else {
            throw `invalid node type "${node.type}" for node ${node.id} at ${node.path}`;
        }
        logger.info(`found ${sourceProcessors.length} processors to execute`);

        // set up the source file path
        let filepath: URL;
        if (node.type === "page") {
            filepath = resolvePath(
                node.context.pageSource!,
                path.resolve(node.path, sourceDirectory),
                {
                    "~source-directory": sourceDirectory,
                },
            );
        } else if (node.type === "page.file" || node.type === "asset") {
            filepath = resolvePath(node.path, sourceDirectory, {
                "~source-directory": sourceDirectory,
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
        let i = 0;
        for (const processor of sourceProcessors) {
            logger.info(
                `running finalize function for processor ${i} (${processor.url.pathname})`,
            );
            i++;
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
                        logger,
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
        logger.info("finished running all finalizers");

        logger.info("writing processed contents to staging directory");
        // write to output file
        // note: I considered using fs.copyFile if there were no source processors,
        // but that shouldn't drastically improve performance, and I feel like this is more maintainable.
        await pipeline(
            await cumulative.getSourceStream(),
            createWriteStream(path.join(node.stagingDirectory, "finalized")),
        );
    }

    logger.info("waiting for children finalize");
    await Promise.all(
        node.baseChildren.concat(node.derivedChildren).map((child) =>
            finalizeNode({
                node: child,
                sourceDirectory: sourceDirectory,
                rootNode,
            }),
        ),
    );
    logger.info("finished finalizing");
    return node;
}
