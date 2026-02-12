import fs from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function getTempFile(name: string): Promise<Buffer> {
    return fs.readFile(join(process.env["TMP_DIR"] || "", name));
}
export function tempDir(): string {
    return process.env["TMP_DIR"] as string;
}

export async function makeTempFile(
    name: string,
    contents: string,
): Promise<string> {
    if (!process.env["TMP_DIR"]) {
        fail("no temp dir was provided");
    }
    const filePath = resolve(join(process.env["TMP_DIR"] as string, name));
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents);

    return filePath;
}

export async function removeTempFile(name: string): Promise<void> {
    if (!process.env["TMP_DIR"]) {
        fail("no temp dir was provided");
    }
    const filePath = resolve(join(process.env["TMP_DIR"] as string, name));
    await fs.rm(filePath);
}

export async function updateTempFile(
    name: string,
    contents: string,
): Promise<string> {
    const filePath = resolve(join(process.env["TMP_DIR"] as string, name));
    await fs.writeFile(filePath, contents);
    return filePath;
}

export async function makeTempFiles(files: {
    [key: string]: string;
}): Promise<string> {
    await Promise.all(
        Object.entries(files).map(([path, contents]) =>
            makeTempFile(path, contents),
        ),
    );
    return tempDir();
}
