import { createRequire } from "node:module";
import path from "node:path";
import { URL } from "node:url";

export type ReservedPrefix =
    /**
     * The root directory of the tartan project.
     * In other words, the path of the root node.
     */
    | "~root"
    /**
     * If this prefix is present, the content after that will be resolved as if it were a module specifier rather than a regular path (using `require.resolve`).
     * This will *always* be an option, regardless of if it's actually specified in the prefix map. If it *is* specified, the value will be ignored.
     */
    | "~node-module";

export type PrefixMap = Omit<
    {
        [K in ReservedPrefix]: string | undefined; // the intention is that reserved prefixes must be explicitely defined, although they may not always be used
    },
    "~node-module"
> & { [key: string]: string | undefined };

if (!globalThis.require) {
    globalThis.require = createRequire(import.meta.url);
}
/**
 * @returns A file url object
 */
export function resolvePath(
    /**
     * The path to resolve.
     */
    pathToResolve: string,
    /**
     * The directory to resolve the path relative to.
     */
    relativeTo: string,
    /**
     * A map of prefixes to path parts.
     */
    prefixMap: PrefixMap,
): URL {
    if (pathToResolve.startsWith("~node-module")) {
        return pathToFileURL(
            require.resolve(pathToResolve.slice("~node-module".length), {
                paths: [relativeTo || process.cwd()],
            }),
        );
    }

    for (const prefix of Object.keys(prefixMap)) {
        if (pathToResolve.startsWith(prefix)) {
            if (prefixMap[prefix] === undefined) {
                throw `Prefix ${prefix} is not available`;
            }
            return pathToFileURL(
                path.resolve(
                    relativeTo,
                    prefixMap[prefix] + pathToResolve.slice(prefix.length),
                ),
            );
        }
    }
    return pathToFileURL(path.resolve(relativeTo, pathToResolve));
}

/**
 * Necessary to preserve search params.
 * The builtin `pathToFileUrl` will turn `./file?option=value` into `./file%3Foption=value`, and the resulting URL object will have no search params
 */
export function pathToFileURL(path: string): URL {
    return new URL(path, "file://" + process.cwd() + "/");
}
