import { loadContextTreeNode } from "../../src/phases/discovery.js";
import { processNode } from "../../src/phases/processing.js";
import {
    ContextTreeNode,
    OutputtedNode,
    ProcessedNode,
    ResolvedNode,
} from "../../src/types/nodes.js";
import { getTempFile, makeTempFiles, tempDir } from "../utils/filesystem.js";
import fs from "fs/promises";
import path from "path";
import { TartanContextFile } from "../../src/types/tartan-context.js";
import { resolveNode } from "../../src/phases/resolving.js";
import { finalizeNode } from "../../src/phases/finalizing.js";
import { outputNode } from "../../src/phases/output.js";
import { nullLogger } from "../helpers/logs.js";

async function processTree() {
    const node: ContextTreeNode = await loadContextTreeNode({
        directory: tempDir(),
        rootContext: {
            pageMode: "directory",
            pageSource: "index.html",
        },
        baseLogger: nullLogger,
    });
    const processedNode: ProcessedNode = await processNode({
        node: node,
        sourceDirectory: tempDir(),
        rootContext: {
            pageMode: "directory",
            pageSource: "index.html",
        },
        baseLogger: nullLogger,
    });
    const resolvedNode: ResolvedNode = resolveNode(processedNode);
    const finalizedNode: ResolvedNode = await finalizeNode({
        node: resolvedNode,
        sourceDirectory: tempDir(),
    });
    const outputDir: string = path.join(tempDir(), "output");

    const outputted = await outputNode(finalizedNode, outputDir);
    return { outputDir: outputDir, node: outputted };
}

describe("The node outputter", () => {
    it("should output finalized pages to index.html", async () => {
        const tmpDir: string = await makeTempFiles({
            "tartan.context.default.json": JSON.stringify({
                pageMode: "file",
                pageSource: "source.md",
                pagePattern: "*.md",
            } as TartanContextFile),
            "source.md": "source",
            "child-one.md": "child one",
            "child-two.md": "child two",
        });

        const { outputDir, node } = await processTree();

        const source: string = await fs
            .readFile(path.join(outputDir, "index.html"))
            .then((val) => val.toString());
        const childOne: string = await fs
            .readFile(path.join(outputDir, "child-one", "index.html"))
            .then((val) => val.toString());
        const childTwo: string = await fs
            .readFile(path.join(outputDir, "child-two", "index.html"))
            .then((val) => val.toString());

        expect(source).toBe("source");
        expect(childOne).toBe("child one");
        expect(childTwo).toBe("child two");
    });
    it("should output assets to their path", async () => {
        const tmpDir: string = await makeTempFiles({
            "tartan.context.default.json": JSON.stringify({
                pageMode: "asset",
                pageSource: "source.md",
                pagePattern: "*.png",
            } as TartanContextFile),
            "source.md": "source",
            "child-one.png": "child one", // ik totally a png :p
            "child-two.png": "child two",
        });

        const { outputDir, node } = await processTree();

        const source: string = await fs
            .readFile(path.join(outputDir, "index.html"))
            .then((val) => val.toString());
        const childOne: string = await fs
            .readFile(path.join(outputDir, "child-one.png"))
            .then((val) => val.toString());
        const childTwo: string = await fs
            .readFile(path.join(outputDir, "child-two.png"))
            .then((val) => val.toString());

        expect(source).toBe("source");
        expect(childOne).toBe("child one");
        expect(childTwo).toBe("child two");
    });
    it("should output handoff nodes to their paths", async () => {
        await makeTempFiles({
            "handoff.js": `import fs from "fs/promises"; import path from "path"; export default {finalize: async (input) => {
                if (input.thisNode.type === "handoff.file") {
                    await fs.writeFile(path.join(input.stagingDirectory, "finalized"), "hello world");
                }
                else if (input.thisNode.type === "handoff") {
                    await fs.mkdir(path.join(input.stagingDirectory, "finalized"), {recursive: true});
                    await fs.writeFile(path.join(input.stagingDirectory, "finalized", "testfile"), "hello world");
                }
                return {};
            }}`,
            "tartan.context.default.json": JSON.stringify({
                pageMode: "asset",
                pageSource: "source.md",
                pagePattern: "*.png",
                handoffHandler: "./handoff.js",
            } as TartanContextFile),
            "source.md": "root source",
            "asset.png": "a random asset but it'll be handoffed... handed off?",
            "asset.png.context.json": JSON.stringify({
                pageMode: "handoff",
            } as TartanContextFile),
            "child/tartan.context.json": JSON.stringify({
                pageMode: "handoff",
            } as TartanContextFile),
        });

        const { outputDir, node } = await processTree();

        const childOne: string = await fs
            .readFile(path.join(outputDir, "asset.png"))
            .then((val) => val.toString());
        const childTwo: string = await fs
            .readFile(path.join(outputDir, "child/testfile"))
            .then((val) => val.toString());

        expect(childOne).toBe("hello world");
        expect(childTwo).toBe("hello world");
    });
    it("should return file tree with pages at dir/index.html", async () => {
        await makeTempFiles({
            "tartan.context.default.json": JSON.stringify({
                pageMode: "file",
                pageSource: "source.md",
                pagePattern: "*.md",
            } as TartanContextFile),
            "source.md": "source",
            "child-one.md": "child one",
            "child-two.md": "child two",
        });

        const { node } = await processTree();

        expect(node).toEqual(
            jasmine.objectContaining<OutputtedNode>({
                type: "directory",
                path: ".",
                children: jasmine.arrayWithExactContents([
                    jasmine.objectContaining<OutputtedNode>({
                        type: "file",
                        path: "index.html",
                        size: 6,
                    }),
                    jasmine.objectContaining<OutputtedNode>({
                        type: "directory",
                        path: "child-one",
                        children: jasmine.arrayWithExactContents([
                            jasmine.objectContaining<OutputtedNode>({
                                type: "file",
                                path: "child-one/index.html",
                                size: 9,
                            }),
                        ]),
                    }),
                    jasmine.objectContaining<OutputtedNode>({
                        type: "directory",
                        path: "child-two",
                        children: jasmine.arrayWithExactContents([
                            jasmine.objectContaining<OutputtedNode>({
                                type: "file",
                                path: "child-two/index.html",
                                size: 9,
                            }),
                        ]),
                    }),
                ]),
            }),
        );
    });
    it("should return file tree with assets at their path", async () => {
        const tmpDir: string = await makeTempFiles({
            "tartan.context.default.json": JSON.stringify({
                pageMode: "asset",
                pageSource: "source.md",
                pagePattern: "*.png",
            } as TartanContextFile),
            "source.md": "source",
            "child-one.png": "child one", // ik totally a png :p
            "child-two.png": "child two",
        });

        const { node } = await processTree();

        expect(node).toEqual(
            jasmine.objectContaining<OutputtedNode>({
                type: "directory",
                path: ".",
                children: jasmine.arrayWithExactContents([
                    jasmine.objectContaining<OutputtedNode>({
                        type: "file",
                        path: "index.html",
                        size: 6,
                    }),
                    jasmine.objectContaining<OutputtedNode>({
                        type: "file",
                        path: "child-one.png",
                        size: 9,
                    }),
                    jasmine.objectContaining<OutputtedNode>({
                        type: "file",
                        path: "child-two.png",
                        size: 9,
                    }),
                ]),
            }),
        );
    });
    it("should return file tree containing files outputted by handoff nodes", async () => {
        await makeTempFiles({
            "handoff.js": `import fs from "fs/promises"; import path from "path"; export default {finalize: async (input) => {
                if (input.thisNode.type === "handoff.file") {
                    await fs.writeFile(path.join(input.stagingDirectory, "finalized"), "hello world");
                }
                else if (input.thisNode.type === "handoff") {
                    await fs.mkdir(path.join(input.stagingDirectory, "finalized"), {recursive: true});
                    await fs.writeFile(path.join(input.stagingDirectory, "finalized", "testfile"), "hello world");
                }
                return {};
            }}`,
            "tartan.context.default.json": JSON.stringify({
                pageMode: "asset",
                pageSource: "source.md",
                pagePattern: "*.png",
                handoffHandler: "./handoff.js",
            } as TartanContextFile),
            "asset.png": "a random asset but it'll be handoffed... handed off?",
            "asset.png.context.json": JSON.stringify({
                pageMode: "handoff",
            } as TartanContextFile),
            "child/tartan.context.json": JSON.stringify({
                pageMode: "handoff",
            } as TartanContextFile),
        });

        const { outputDir, node } = await processTree();

        const childOne: string = await fs
            .readFile(path.join(outputDir, "asset.png"))
            .then((val) => val.toString());
        const childTwo: string = await fs
            .readFile(path.join(outputDir, "child/testfile"))
            .then((val) => val.toString());

        expect(childOne).toBe("hello world");
        expect(childTwo).toBe("hello world");

        expect(node).toEqual({
            type: "directory",
            path: ".",
            children: jasmine.arrayWithExactContents([
                jasmine.objectContaining<OutputtedNode>({
                    type: "file",
                    path: "asset.png",
                    size: 11,
                }),
                {
                    type: "directory",
                    path: "child",
                    children: [
                        jasmine.objectContaining<OutputtedNode>({
                            type: "file",
                            path: "child/testfile",
                            size: 11,
                        }),
                    ],
                },
            ]),
        });
    });
});
