import path, { ParsedPath } from "node:path";
import fs from "fs/promises";
import { loadModule } from "./module.js";
import { TartanInput } from "../types/inputs.js";
import { loadFile } from "./file.js";
import { URL } from "node:url";
import { pathToFileURL } from "./resolve.js";
import { Logger } from "winston";
import { FSCache, FSCacheEntry } from "./fs.js";

export const objectFileExtensions = [".ts", ".mts", ".js", ".mjs", ".json"];
/**
 * Mapping extension names into indexes so sorts are easily sortable
 */
const extensionIndexMap: { [key: string]: number } =
    objectFileExtensions.reduce(
        (prev, curr, i) => ({ ...prev, [curr]: i }),
        {} as { [key: string]: number },
    );

// look it's slightly faster. saves about 18% vs a hasmap
function isValidExt(ext: string): boolean {
    return (
        ext === ".ts" ||
        ext === ".mts" ||
        ext === ".js" ||
        ext === ".mjs" ||
        ext === ".json"
    );
}
function isModuleExt(ext: string): boolean {
    return ext === ".ts" || ext === ".mts" || ext === ".js" || ext === ".mjs";
}
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
        const files: FSCacheEntry[] = await FSCache.readdir(
            path.dirname(resolvedFilename.pathname),
        );

        const basename = path.basename(filepath);
        const matchingFiles: FSCacheEntry[] = files
            .filter(
                (val) =>
                    val.isFile() &&
                    isValidExt(val.parsedPath.ext) &&
                    val.parsedPath.name === basename,
            )
            .toSorted((a, b) => {
                const aNum = extensionIndexMap[a.parsedPath.ext];
                const bNum = extensionIndexMap[b.parsedPath.ext];

                return aNum - bNum;
            });
        logger.debug(`found ${matchingFiles.length} possible matches`);

        pathToLoad =
            matchingFiles.length > 0 ? matchingFiles[0].parsedPath : undefined;
    }

    if (pathToLoad === undefined) {
        logger.debug("falling back to default value");
        return {
            value: defaultIfNoFileExists,
            url: resolvedFilename,
        };
    }

    if (isModuleExt(pathToLoad.ext)) {
        logger.debug(`trying to load ${path.format(pathToLoad)} as a module`);
        return {
            value: await loadModule<T>(
                pathToFileURL(path.format(pathToLoad)),
                logger,
            ).then(
                (val) => val.value as T, // ignore the module path, instead setting it to resolvedBasename
            ),
            url: resolvedFilename,
        };
    } else if (pathToLoad.ext === ".json") {
        logger.debug(`trying to load ${path.format(pathToLoad)} as JSON`);
        return {
            value: await loadJSON(pathToFileURL(path.format(pathToLoad))),
            url: resolvedFilename,
        };
    } else {
        logger.error(
            `can't load ${path.format(pathToLoad)}, incompatible file type`,
        );
        throw `can't load ${path.format(pathToLoad)}, incompatible file type`;
    }
}

export async function loadJSON<T>(fileURL: URL): Promise<T> {
    // TODO: object cacheing to reduce disk io
    return loadFile(fileURL).then((val) => JSON.parse(val.value.toString()));
}
