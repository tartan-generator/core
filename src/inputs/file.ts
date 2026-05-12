import { URL } from "url";
import { TartanInput } from "../types/inputs.js";
import fs from "fs/promises";
import { hash } from "crypto";

export async function loadFile(url: URL): Promise<TartanInput<Buffer>> {
    const contents: Buffer = await fs.readFile(url.pathname);
    return new TartanInput(contents, url, hash("sha256", contents), "raw");
}
