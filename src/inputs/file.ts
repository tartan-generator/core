import { URL } from "url";
import { TartanInput } from "../types/inputs.js";
import fs from "fs/promises";

export async function loadFile(url: URL): Promise<TartanInput<Buffer>> {
    return {
        url,
        value: await fs.readFile(url.pathname),
    };
}
