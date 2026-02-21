import {
    FullTartanContext,
    PartialTartanContext,
    TartanContextFile,
} from "../types/tartan-context.js";
import path from "node:path";
import { TartanInput } from "../types/inputs.js";
import { loadObject } from "../inputs/file-object.js";
import { initializeContext } from "../inputs/context.js";
import { Logger, LogLevel } from "../logger.js";
import { minimatch } from "minimatch";
import { Dirent } from "node:fs";
import fs from "fs/promises";
import { ContextTreeNode, NodeType } from "../types/nodes.js";
import { randomUUID } from "node:crypto";
import { resolvePath } from "../inputs/resolve.js";

export async function loadContextTreeNode(params: {
    directory: string;
    filename?: string;
    rootContext: FullTartanContext;
    sourceDirectory?: string;
    parentContext?: FullTartanContext;
    type?: NodeType;
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

    Logger.log(`Loading node at ${nodePath}`);

    const defaultContextFilename: string = path.join(
        resolvedDirectory,
        `${params.filename ?? "tartan"}.context.default`,
    );
    const localContextFilename = path.join(
        resolvedDirectory,
        `${params.filename ?? "tartan"}.context`,
    );

    const defaultContextFile: TartanInput<TartanContextFile> =
        await loadObject<TartanContextFile>(defaultContextFilename, {});
    const localContextFile: TartanInput<TartanContextFile> = await loadObject(
        localContextFilename,
        {},
    );

    const defaultContext: TartanInput<PartialTartanContext> =
        await initializeContext(
            { "~source-directory": sourceDirectory, "~this-node": nodePath },
            defaultContextFile,
        );
    const localContext: TartanInput<PartialTartanContext> =
        await initializeContext(
            { "~source-directory": sourceDirectory, "~this-node": nodePath },
            localContextFile,
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

    // If the pageMode is handoff set to either handoff or handoff.file
    // otherwise set to the type from params, and default to page type
    const type: NodeType =
        context.pageMode === "handoff"
            ? params.type === "page.file" || params.type === "asset"
                ? "handoff.file"
                : "handoff"
            : (params.type ?? "page");

    const children = await loadChildren(
        {
            rootContext: params.rootContext,
            sourceDirectory: sourceDirectory,
            parentContext: inheritableContext,
            localContext: context,
            type: type,
        },
        resolvedDirectory,
    );

    const id = randomUUID();
    const stagingDirectory = path.join(".staging", id);
    return {
        id: id,
        path: nodePath,
        stagingDirectory: stagingDirectory,
        type: type,
        context: context,
        inheritableContext: inheritableContext,
        children: children,
    };
}

type ChildLoaderParams = {
    rootContext: FullTartanContext;
    sourceDirectory: string;
    parentContext: FullTartanContext;
    localContext: FullTartanContext;
    type: NodeType;
};
async function loadChildren(
    params: ChildLoaderParams,
    directory: string,
): Promise<ContextTreeNode[]> {
    Logger.log(`loading children at ${directory}`);
    if (
        params.type === "page.file" ||
        params.type === "asset" ||
        params.type === "handoff" ||
        params.type === "handoff.file"
    ) {
        Logger.log(
            `type ${params.type} doesn't load children`,
            LogLevel.Verbose,
        );
        return [];
    }

    const entries = await fs.readdir(directory, {
        withFileTypes: true,
    });

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

function loadDirectoryChildren(
    params: ChildLoaderParams,
    entries: Dirent<string>[],
): Promise<ContextTreeNode>[] {
    return entries
        .filter((entry) => entry.isDirectory())
        .map((dir) =>
            loadContextTreeNode({
                directory: path.join(dir.parentPath, dir.name),
                sourceDirectory: params.sourceDirectory,
                parentContext: params.parentContext,
                rootContext: params.rootContext,
                type: "page",
            }),
        );
}
function loadFileChildren(
    params: ChildLoaderParams,
    entries: Dirent<string>[],
): Promise<ContextTreeNode>[] {
    return entries
        .filter(
            (entry) =>
                entry.isFile() &&
                minimatch(
                    entry.name,
                    params.parentContext.pagePattern as string,
                ) &&
                entry.name !== params.localContext.pageSource,
        )
        .map((file) =>
            loadContextTreeNode({
                directory: file.parentPath,
                filename: file.name,
                sourceDirectory: params.sourceDirectory,
                parentContext: params.parentContext,
                rootContext: params.rootContext,
                type: "page.file",
            }),
        );
}
function loadAssetChildren(
    params: ChildLoaderParams,
    entries: Dirent<string>[],
): Promise<ContextTreeNode>[] {
    return entries
        .filter(
            (entry) =>
                entry.isFile() &&
                minimatch(
                    entry.name,
                    params.parentContext.pagePattern as string,
                ) &&
                entry.name !== params.localContext.pageSource,
        )
        .map((file) =>
            loadContextTreeNode({
                directory: file.parentPath,
                filename: file.name,
                sourceDirectory: params.sourceDirectory,
                parentContext: params.parentContext,
                rootContext: params.rootContext,
                type: "asset",
            }),
        );
}
