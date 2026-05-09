import path, { ParsedPath } from "node:path";
import fs from "fs/promises";
import { loadModule } from "./module.js";
import { Dirent } from "node:fs";
import { TartanInput } from "../types/inputs.js";
import { loadFile } from "./file.js";
import { URL } from "node:url";
import { pathToFileURL } from "./resolve.js";
import { Logger } from "winston";

export const objectFileExtensions = [".ts", ".mts", ".js", ".mjs", ".json"];
const objectFileExtensionSet = new Set(objectFileExtensions);
const moduleFileExtensions = new Set(objectFileExtensions.slice(0, -1));
/**
 * Mapping extension names into indexes so sorts are easily sortable
 */
const extensionIndexMap: { [key: string]: number } =
    objectFileExtensions.reduce(
        (prev, curr, i) => ({ ...prev, [curr]: i }),
        {} as { [key: string]: number },
    );

export async function loadObject<T>(
    filepath: string,
    defaultIfNoFileExists: T,
    logger: Logger,
    /**
     * Whether the extension was explicitly included in `filepath`.
     *
     * Supported extensions are: `.ts`, `.mts`, `.js`, `.mjs`, and `.json`
     *
     * If set to false, will try each of the extensions listed, in order.
     * If set to true, the extension must be one of the listed extensions.
     */
    hasExtension: boolean = false,
): Promise<TartanInput<T>> {
    logger.debug(`trying to load object at ${filepath}`);
    let pathToLoad: ParsedPath | undefined = undefined;
    const resolvedFilename: URL = pathToFileURL(path.resolve(filepath));
    if (hasExtension) {
        const exists: boolean = await fs
            .stat(resolvedFilename)
            .then((stat) => stat.isFile())
            .catch(() => false);
        pathToLoad = exists ? path.parse(resolvedFilename.pathname) : undefined;
    } else {
        const files = await fs.readdir(
            path.dirname(resolvedFilename.pathname),
            {
                withFileTypes: true,
            },
        );
        const matchingFiles: Dirent<string>[] = files
            .filter(
                (val) =>
                    val.isFile() &&
                    objectFileExtensionSet.has(path.parse(val.name).ext) &&
                    path.parse(val.name).name === path.basename(filepath),
            )
            .toSorted((a, b) => {
                const aNum = extensionIndexMap[path.parse(a.name).ext];
                const bNum = extensionIndexMap[path.parse(b.name).ext];

                return aNum - bNum;
            });
        logger.debug(`found ${matchingFiles.length} possible matches`);

        pathToLoad =
            matchingFiles.length > 0
                ? path.parse(
                      path.join(
                          matchingFiles[0].parentPath,
                          matchingFiles[0].name,
                      ),
                  )
                : undefined;
    }

    if (pathToLoad === undefined) {
        logger.debug("falling back to default value");
        return new TartanInput(
            defaultIfNoFileExists,
            resolvedFilename,
            "",
            "default",
        );
    }

    if (moduleFileExtensions.has(pathToLoad.ext)) {
        logger.debug(`trying to load ${path.format(pathToLoad)} as a module`);
        const module = await loadModule<T>(
            pathToFileURL(path.format(pathToLoad)),
            logger,
        );
        module.url = resolvedFilename;
        return module;
    } else if (pathToLoad.ext === ".json") {
        logger.debug(`trying to load ${path.format(pathToLoad)} as JSON`);
        const val: TartanInput<T> = await loadJSON(
            pathToFileURL(path.format(pathToLoad)),
        );
        val.url = resolvedFilename;
        return val;
    } else {
        logger.error(
            `can't load ${path.format(pathToLoad)}, incompatible file type`,
        );
        throw `can't load ${path.format(pathToLoad)}, incompatible file type`;
    }
}

export async function loadJSON<T>(fileURL: URL): Promise<TartanInput<T>> {
    const file: TartanInput<Buffer> = await loadFile(fileURL);

    return new TartanInput(
        JSON.parse(file.value.toString()),
        file.url,
        file.hash, // I'll implement merkle tree hashing later, maybe... (https://github.com/tartan-generator/core/issues/10)
        "json",
    );
}
