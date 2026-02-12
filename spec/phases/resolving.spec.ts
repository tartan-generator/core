import path from "node:path";
import { loadContextTreeNode } from "../../src/phases/discovery.js";
import { processNode } from "../../src/phases/processing.js";
import { resolveNode } from "../../src/phases/resolving.js";
import {
    FullTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { makeTempFiles } from "../utils/filesystem.js";

describe("The node resolver", () => {
    it("should resolve all the nodes in the tree, and not let the root node change it's output path", async () => {
        const tmpDir = await makeTempFiles({
            "tartan.context.default.json": JSON.stringify({
                pageMode: "directory",
                pageSource: "index",
                sourceProcessors: ["./processor.js"],
            } as TartanContextFile),
            "processor.js": `export default {process: async (input) => ({
                processedContents: await input.getSourceStream(),
                outputPath: "owo",
            })}`,
            index: "",
            "child/index": "",
            "child/subchild/index": "",
        });

        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index",
        };
        const node = await loadContextTreeNode({
            directory: tmpDir,
            rootContext,
        });
        const processed = await processNode({
            node,
            rootContext,
            rootDirectory: tmpDir,
            isRoot: true,
        });
        const resolved = resolveNode(processed);

        expect(resolved.outputPath).toBe(".");
        expect(resolved.baseChildren[0].outputPath).toBe("owo");
        expect(resolved.baseChildren[0].baseChildren[0].outputPath).toBe(
            "owo/owo",
        );
    });
});
