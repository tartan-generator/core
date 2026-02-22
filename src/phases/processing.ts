import {
    HandoffHandler,
    HandoffHandlerOutput,
} from "../types/handoff-handler.js";
import { TartanInput } from "../types/inputs.js";
import { ContextTreeNode, ProcessedNode } from "../types/nodes.js";
import { FullTartanContext } from "../types/tartan-context.js";
import fs from "fs/promises";
import { resolvePath } from "../inputs/resolve.js";
import path from "path";
import {
    SourceProcessor,
    SourceProcessorInput,
    SourceProcessorOutput,
} from "../types/source-processor.js";
import { minimatch } from "minimatch";
import { buffer } from "stream/consumers";
import { Readable } from "stream";
import { loadContextTreeNode } from "./discovery.js";
import { URL } from "node:url";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Logger } from "winston";

export async function processNode(params: {
    node: ContextTreeNode;
    rootContext: FullTartanContext;
    /**
     * The directory the root node was loaded from.
     */
    sourceDirectory: string;
    /**
     * The base logger for derived nodes to use
     */
    baseLogger: Logger;
    /**
     * Whether this node is the root node.
     *
     * @default true
     */
    isRoot?: boolean;
}): Promise<ProcessedNode> {
    const logger = params.node.logger.child({ phase: "processing" });
    const { node, rootContext, sourceDirectory, isRoot = true } = params;
    logger.info("starting node processing");
    /*
     * Process child nodes.
     */
    logger.info("processing children");
    const processedChildren: ProcessedNode[] = await Promise.all(
        node.children.map((child) =>
            processNode({
                node: child,
                rootContext: rootContext,
                sourceDirectory: sourceDirectory,
                isRoot: false,
                baseLogger: params.baseLogger,
            }),
        ),
    );

    logger.debug(`creating staging directory at ${node.stagingDirectory}`);
    await fs.mkdir(node.stagingDirectory, { recursive: true });

    if (node.type === "handoff" || node.type === "handoff.file") {
        /*
         * HANDOFF HANDLER
         */
        logger.debug(`Node is "handoff" type`);
        if (node.context.handoffHandler === undefined) {
            throw `No handoff handler object for handoff node ${node.id} at ${node.path}`;
        }
        const handoffHandler: HandoffHandler =
            node.context.handoffHandler.value;

        // Execute handoff handler
        logger.debug(
            `handoff handler found at ${node.context.handoffHandler.url.pathname}`,
        );
        logger.info("executing handoff handler's `process` function");
        let output: HandoffHandlerOutput = {};
        if (handoffHandler.process) {
            output = await handoffHandler.process({
                extraContext: node.context.extraContext,
                extraParameters: node.context.handoffHandler.url.searchParams,
                nodePath: node.path,
                stagingDirectory: node.stagingDirectory,
                isRoot: isRoot,
                isFile: node.type === "handoff.file",
            });
        }
        logger.debug(
            `Handoff handler outputted ${JSON.stringify(output, null, 4)}`,
        );

        // Return a ProcessedNode
        return {
            id: node.id,
            path: node.path,
            type: node.type,
            outputPath: output.outputPath,
            stagingDirectory: node.stagingDirectory,
            context: node.context,
            inheritableContext: node.inheritableContext,
            metadata: output.metadata ?? {},
            baseChildren: processedChildren,
            derivedChildren: [],
            logger: params.node.logger,
        };
    } else {
        /*
         * SOURCE PROCESSOR
         */
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
        let sourcePath: URL;
        if (node.type === "page") {
            sourcePath = resolvePath(
                node.context.pageSource!,
                path.resolve(node.path, sourceDirectory),
                {
                    "~source-directory": sourceDirectory,
                },
            );
        } else if (node.type === "page.file" || node.type === "asset") {
            sourcePath = resolvePath(node.path, sourceDirectory, {
                "~source-directory": sourceDirectory,
            });
        } else {
            throw `invalid node type "${node.type}" for node ${node.id} at ${node.path}`;
        }

        logger.debug(`loading initial source from ${sourcePath.pathname}`);

        /*
         * Set up all the transient params (passed from processor to processor)
         */
        const cumulative = {
            getSourceBuffer: (() =>
                fs.readFile(
                    sourcePath,
                )) as SourceProcessorInput["getSourceBuffer"],
            getSourceStream: (() =>
                fs
                    .open(sourcePath)
                    .then((handle) =>
                        handle.createReadStream(),
                    )) as SourceProcessorInput["getSourceStream"],
            sourceMetadata: {} as SourceProcessorInput["sourceMetadata"],
            outputPath: undefined as SourceProcessorInput["outputPath"],
            dependencies: [] as string[],
        };

        /*
         * Run all the source processors
         */
        let i = 0;
        for (const processor of sourceProcessors) {
            logger.info(
                `running process function of processor ${i} (${processor.url.pathname})`,
            );
            i++;
            if (processor.value.process) {
                const output: SourceProcessorOutput =
                    await processor.value.process({
                        getSourceBuffer: cumulative.getSourceBuffer,
                        getSourceStream: cumulative.getSourceStream,
                        extraContext: node.context.extraContext,
                        pathParameters: processor.url.searchParams,
                        sourceMetadata: cumulative.sourceMetadata,
                        sourcePath: sourcePath.pathname,
                        outputPath: cumulative.outputPath,
                        isRoot,
                        children: processedChildren,
                        dependencies: cumulative.dependencies,
                    });

                // update transient params again
                const contents = output.processedContents;
                cumulative.getSourceBuffer =
                    contents instanceof Buffer
                        ? async () => contents
                        : async () => buffer(contents as Readable);
                cumulative.getSourceStream =
                    contents instanceof Readable
                        ? async () => contents
                        : async () => Readable.from(contents as Buffer);
                cumulative.sourceMetadata = {
                    ...cumulative.sourceMetadata,
                    ...output.sourceMetadata,
                };
                cumulative.outputPath =
                    output.outputPath ?? cumulative.outputPath;
                cumulative.dependencies = Array.from(
                    new Set(
                        cumulative.dependencies.concat(
                            (output.dependencies ?? []).map(
                                // resolve relative to the source file
                                (dependency) =>
                                    resolvePath(
                                        dependency,
                                        path.dirname(sourcePath.pathname),
                                        {
                                            "~source-directory":
                                                sourceDirectory,
                                            "~this-node":
                                                node.type === "page"
                                                    ? node.path
                                                    : path.dirname(node.path),
                                            "~source-processor": path.dirname(
                                                processor.url.pathname,
                                            ),
                                        },
                                    ).pathname,
                            ),
                        ),
                    ),
                ); // ik this isn't efficient but it shouldn't matter}
            }
        }

        logger.info("finished executing all source processors");

        logger.info("writing processed contents to staging directory");
        // write to output file
        // note: I considered using fs.copyFile if there were no source processors,
        // but that shouldn't drastically improve performance, and I feel like this is more maintainable.
        await pipeline(
            await cumulative.getSourceStream(),
            createWriteStream(path.join(node.stagingDirectory, "processed")),
        );

        logger.info(
            `loading ${cumulative.dependencies.length} derived children`,
        );
        const derivedChildren: ProcessedNode[] = await Promise.all(
            cumulative.dependencies.map((dependency) =>
                loadContextTreeNode({
                    directory: path.dirname(dependency),
                    filename: path.basename(dependency),
                    type: "asset",
                    rootContext: rootContext,
                    sourceDirectory: sourceDirectory,
                    parentContext: node.inheritableContext,
                    baseLogger: params.baseLogger,
                }).then((node) =>
                    processNode({
                        node,
                        rootContext,
                        sourceDirectory: sourceDirectory,
                        isRoot: false,
                        baseLogger: params.baseLogger,
                    }),
                ),
            ),
        );

        logger.info("finished processing");
        return {
            id: node.id,
            path: node.path,
            type: node.type,
            outputPath: cumulative.outputPath,
            stagingDirectory: node.stagingDirectory,
            context: node.context,
            inheritableContext: node.inheritableContext,
            metadata: cumulative.sourceMetadata,
            baseChildren: processedChildren,
            derivedChildren,
            logger: node.logger,
        };
    }
}
