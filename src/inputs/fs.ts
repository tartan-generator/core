import { Dirent } from "node:fs";
import { readdir, access } from "node:fs/promises";
import { dirname, join, parse, ParsedPath, resolve } from "node:path";

// compatible with regular Dirent so that in-place substitutions are easier
export type FSCacheEntry = Dirent<string> & { parsedPath: ParsedPath };
type CacheObject = {
    itemSet: Set<string>;
    itemArr: FSCacheEntry[];
};
export class FSCache {
    private static cache: Map<string, CacheObject> = new Map();
    public static async populateCache(sourceDir: string) {
        const entries = await readdir(resolve(sourceDir), {
            withFileTypes: true,
            recursive: true,
        });
        this.cache = new Map();
        for (const entry of entries) {
            const fullPath: string = join(entry.parentPath, entry.name);
            if (this.cache.has(entry.parentPath)) {
                const cacheObj = this.cache.get(entry.parentPath);
                cacheObj!.itemArr.push(
                    Object.defineProperty(entry, "parsedPath", {
                        value: parse(fullPath),
                        enumerable: true,
                    }) as FSCacheEntry,
                );
                cacheObj!.itemSet.add(fullPath);
            } else {
                this.cache.set(entry.parentPath, {
                    itemArr: [
                        Object.defineProperty(entry, "parsedPath", {
                            value: parse(fullPath),
                            enumerable: true,
                        }) as FSCacheEntry,
                    ],
                    itemSet: new Set([fullPath]),
                });
            }
        }
    }
    public static purgeCache() {
        this.cache = new Map();
    }
    public static async readdir(dir: string): Promise<FSCacheEntry[]> {
        return (
            this.cache.get(resolve(dir))?.itemArr ??
            (await readdir(dir, { withFileTypes: true })).map(
                (val) =>
                    Object.defineProperty(val, "parsedPath", {
                        value: parse(join(val.parentPath, val.name)),
                        enumerable: true,
                    }) as FSCacheEntry,
            )
        );
    }

    public static async exists(path: string): Promise<boolean> {
        const resolvedPath = resolve(path);
        const parentCacheObj: CacheObject | undefined = this.cache.get(
            dirname(resolvedPath),
        );
        if (parentCacheObj) {
            const val = parentCacheObj.itemSet.has(resolvedPath);
            return val;
        } else {
            const val = await access(path)
                .then(() => true)
                .catch(() => false);

            return val;
        }
    }
}
