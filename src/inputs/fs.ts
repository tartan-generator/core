import { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export class FSCache {
    private static cache: Map<string, Dirent<string>[]> = new Map();
    public static async populateCache(sourceDir: string) {
        const entries = await readdir(resolve(sourceDir), {
            withFileTypes: true,
            recursive: true,
        });
        this.cache = new Map();
        for (const entry of entries) {
            if (this.cache.has(entry.parentPath)) {
                this.cache.get(entry.parentPath)!.push(entry);
            } else {
                this.cache.set(entry.parentPath, [entry]);
            }
        }
    }

    public static async readdir(dir: string): Promise<Dirent<string>[]> {
        return (
            this.cache.get(resolve(dir)) ??
            (await readdir(dir, { withFileTypes: true }))
        );
    }
}
