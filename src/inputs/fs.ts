import { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, parse, ParsedPath, resolve } from "node:path";

// compatible with regular Dirent so that in-place substitutions are easier
export type FSCacheEntry = Dirent<string> & { parsedPath: ParsedPath };
export class FSCache {
    private static cache: Map<string, FSCacheEntry[]> = new Map();
    public static async populateCache(sourceDir: string) {
        const entries = await readdir(resolve(sourceDir), {
            withFileTypes: true,
            recursive: true,
        });
        this.cache = new Map();
        for (const entry of entries) {
            if (this.cache.has(entry.parentPath)) {
                this.cache.get(entry.parentPath)!.push(
                    Object.defineProperty(entry, "parsedPath", {
                        value: parse(join(entry.parentPath, entry.name)),
                        enumerable: true,
                    }) as FSCacheEntry,
                );
            } else {
                this.cache.set(entry.parentPath, [
                    Object.defineProperty(entry, "parsedPath", {
                        value: parse(join(entry.parentPath, entry.name)),
                        enumerable: true,
                    }) as FSCacheEntry,
                ]);
            }
        }
    }

    public static async readdir(dir: string): Promise<FSCacheEntry[]> {
        return (
            this.cache.get(resolve(dir)) ??
            (await readdir(dir, { withFileTypes: true })).map(
                (val) =>
                    Object.defineProperty(val, "parsedPath", {
                        value: parse(join(val.parentPath, val.name)),
                        enumerable: true,
                    }) as FSCacheEntry,
            )
        );
    }
}
