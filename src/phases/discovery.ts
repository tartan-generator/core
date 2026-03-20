import {
    FullTartanContext,
    PartialTartanContext,
    TartanContextFile,
} from "../types/tartan-context.js";
import path from "node:path";
import { TartanInput } from "../types/inputs.js";
import { loadObject, objectFileExtensions } from "../inputs/file-object.js";
import { initializeContext } from "../inputs/context.js";
import { minimatch } from "minimatch";
import { Dirent } from "node:fs";
import fs from "fs/promises";
import { ContextTreeNode, NodeType } from "../types/nodes.js";
import { randomUUID } from "node:crypto";
import { resolvePath } from "../inputs/resolve.js";
import { Logger } from "winston";
import { pathToFileURL } from "node:url";
import { FSCache } from "../inputs/fs.js";

export async function loadContextTreeNode(params: {
    directory: string;
    filename?: string;
    rootContext: FullTartanContext;
    sourceDirectory?: string;
    parentContext?: FullTartanContext;
    type?: Exclude<NodeType, "handoff" | "handoff.file" | "container">;
    /**
     * A logger with transport and format already set up.
     */
    baseLogger: Logger;
}): Promise<ContextTreeNode<NodeType>> {
    const sourceDirectory = path.resolve(
        params.sourceDirectory ?? params.directory,
    );
    const relativeDirectory: string = path.normalize(
        path.relative(sourceDirectory, params.directory),
    );
    const resolvedDirectory: string = resolvePath(
        relativeDirectory,
        sourceDirectory,
        {},
    ).pathname;
    const nodePath: string = path.join(
        relativeDirectory,
        params.filename ?? "",
    );
    const id = randomUUID();

    // set up logger
    const nodeLogger = params.baseLogger.child({
        nodeId: id,
        nodePath: nodePath,
    });
    const logger = nodeLogger.child({ phase: "discovery" });

    logger.info("loading context objects");
    const defaultContextFilename: string = path.join(
        resolvedDirectory,
        `${params.filename ?? "tartan"}.context.default`,
    );
    const localContextFilename = path.join(
        resolvedDirectory,
        `${params.filename ?? "tartan"}.context`,
    );

    const defaultContextFile: TartanInput<TartanContextFile> =
        await loadObject<TartanContextFile>(defaultContextFilename, {}, logger);
    const localContextFile: TartanInput<TartanContextFile> = await loadObject(
        localContextFilename,
        {},
        logger,
    );

    logger.info("initializing context objects");
    const defaultContext: TartanInput<PartialTartanContext> =
        await initializeContext(
            { "~source-directory": sourceDirectory, "~this-node": nodePath },
            defaultContextFile,
            logger,
        );
    const localContext: TartanInput<PartialTartanContext> =
        await initializeContext(
            { "~source-directory": sourceDirectory, "~this-node": nodePath },
            localContextFile,
            logger,
        );

    const inheritableContext: FullTartanContext = (
        defaultContext.value.inherit === false
            ? {
                  ...params.rootContext,
                  ...defaultContext.value,
              }
            : {
                  ...params.rootContext,
                  ...params.parentContext,
                  ...defaultContext.value,
              }
    ) as FullTartanContext;
    const context: FullTartanContext = (
        defaultContext.value.inherit === false
            ? {
                  ...params.rootContext,
                  ...localContext.value,
              }
            : {
                  ...params.rootContext,
                  ...params.parentContext,
                  ...inheritableContext,
                  ...localContext.value,
              }
    ) as FullTartanContext;

    let type: NodeType = params.type ?? "page"; // default to page type

    // resolve a source path
    let sourcePath: URL | undefined;
    if (type === "page") {
        sourcePath =
            context.pageSource === undefined
                ? undefined
                : resolvePath(
                      context.pageSource,
                      path.join(sourceDirectory, nodePath),
                      {
                          "~source-directory": sourceDirectory,
                          ...(context.pathPrefixes ?? {}),
                      },
                  );
    } else {
        sourcePath = pathToFileURL(path.join(sourceDirectory, nodePath));
    }

    // override the type if necessary
    if (context.pageMode === "handoff") {
        type =
            params.type === "page.file" || params.type === "asset"
                ? "handoff.file"
                : "handoff";
    } else if (context.pageMode === "container") {
        type = "container";
        sourcePath = undefined;
    } else if (type === "page") {
        // the path exists and is a file
        const valid: boolean =
            sourcePath !== undefined
                ? await fs
                      .stat(sourcePath)
                      .then((stat) => stat.isFile())
                      .catch(() => false)
                : false;

        if (!valid) {
            type = "container";
            sourcePath = undefined;
        }
    }

    const ignoredPaths: string[] = objectFileExtensions.flatMap((extension) => [
        `*.context${extension}`,
        `*.context.default${extension}`,
    ]);
    const children = await loadChildren(
        {
            rootContext: params.rootContext,
            sourceDirectory: sourceDirectory,
            parentContext: inheritableContext,
            localContext: context,
            type: type,
            logger: logger,
            baseLogger: params.baseLogger,
            ignored: ignoredPaths,
        },
        resolvedDirectory,
    );

    const stagingDirectory = path.join(".staging", id);
    return {
        id: id,
        path: nodePath,
        sourcePath,
        stagingDirectory: stagingDirectory,
        type: type,
        context: context,
        inheritableContext: inheritableContext,
        children: children,
        logger: nodeLogger,
    };
}

type ChildLoaderParams = {
    rootContext: FullTartanContext;
    sourceDirectory: string;
    parentContext: FullTartanContext;
    localContext: FullTartanContext;
    ignored: string[];
    type: NodeType;
    /**
     * The local logger with phase and everything else set up.
     */
    logger: Logger;
    /**
     * The base logger to be passed on to children.
     */
    baseLogger: Logger;
};
async function loadChildren(
    params: ChildLoaderParams,
    directory: string,
): Promise<ContextTreeNode[]> {
    const logger = params.logger;
    logger.info("trying to load children");
    if (
        params.type === "page.file" ||
        params.type === "asset" ||
        params.type === "handoff" ||
        params.type === "handoff.file"
    ) {
        logger.info(`type ${params.type} doesn't allow children`);
        return [];
    }

    const entries = await FSCache.readdir(directory);
    if (params.localContext.pageMode === "directory") {
        return Promise.all(loadDirectoryChildren(params, entries));
    } else if (params.localContext.pageMode === "file") {
        return Promise.all([
            ...loadDirectoryChildren(params, entries),
            ...loadFileChildren(params, entries),
        ]);
    } else if (params.localContext.pageMode === "asset") {
        return Promise.all([
            ...loadDirectoryChildren(params, entries),
            ...loadAssetChildren(params, entries),
        ]);
    } else {
        return [];
    }
}

function isIgnored(ignoredGlobs: string[], string: string): boolean {
    return ignoredGlobs.some((glob) => minimatch(string, glob));
}

function loadDirectoryChildren(
    params: ChildLoaderParams,
    entries: Dirent<string>[],
): Promise<ContextTreeNode>[] {
    const filteredEntries = entries.filter(
        (entry) =>
            entry.isDirectory() && !isIgnored(params.ignored, entry.name),
    );
    params.logger.info(
        `loading the following directories as page children: ${filteredEntries.map((ent) => ent.name).join(",")}`,
    );
    return filteredEntries.map((dir) =>
        loadContextTreeNode({
            directory: path.join(dir.parentPath, dir.name),
            sourceDirectory: params.sourceDirectory,
            parentContext: params.parentContext,
            rootContext: params.rootContext,
            type: "page",
            baseLogger: params.baseLogger,
        }),
    );
}
function loadFileChildren(
    params: ChildLoaderParams,
    entries: Dirent<string>[],
): Promise<ContextTreeNode>[] {
    const filteredEntries = entries.filter(
        (entry) =>
            entry.isFile() &&
            entry.name !== params.localContext.pageSource &&
            minimatch(entry.name, params.localContext.pagePattern as string) &&
            !isIgnored(params.ignored, entry.name),
    );
    params.logger.info(
        `loading the following files as page children: ${filteredEntries.map((ent) => ent.name).join(",")}`,
    );
    return filteredEntries.map((file) =>
        loadContextTreeNode({
            directory: file.parentPath,
            filename: file.name,
            sourceDirectory: params.sourceDirectory,
            parentContext: params.parentContext,
            rootContext: params.rootContext,
            type: "page.file",
            baseLogger: params.baseLogger,
        }),
    );
}
function loadAssetChildren(
    params: ChildLoaderParams,
    entries: Dirent<string>[],
): Promise<ContextTreeNode>[] {
    const filteredEntries = entries.filter(
        (entry) =>
            entry.isFile() &&
            entry.name !== params.localContext.pageSource &&
            minimatch(entry.name, params.localContext.pagePattern as string) &&
            !isIgnored(params.ignored, entry.name),
    );
    params.logger.info(
        `loading the following files as asset children: ${filteredEntries.map((ent) => ent.name).join(",")}`,
    );
    return filteredEntries.map((file) =>
        loadContextTreeNode({
            directory: file.parentPath,
            filename: file.name,
            sourceDirectory: params.sourceDirectory,
            parentContext: params.parentContext,
            rootContext: params.rootContext,
            type: "asset",
            baseLogger: params.baseLogger,
        }),
    );
}
