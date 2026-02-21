import { loadContextTreeNode } from "../../src/phases/discovery.js";
import { processNode } from "../../src/phases/processing.js";
import {
    ContextTreeNode,
    ProcessedNode,
    ResolvedNode,
} from "../../src/types/nodes.js";
import { makeTempFiles, tempDir } from "../utils/filesystem.js";
import fs from "fs/promises";
import path from "path";
import { TartanContextFile } from "../../src/types/tartan-context.js";
import { resolveNode } from "../../src/phases/resolving.js";
import { finalizeNode } from "../../src/phases/finalizing.js";

describe("The node finalizer", () => {
    describe("when executing source finalizers", () => {
        it("should execute for all children", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
                "tartan.context.default.json": JSON.stringify({
                    pageMode: "file",
                    pagePattern: "*.md",
                } as TartanContextFile),
                "a.md": "aaaa",
            });

            const node: ContextTreeNode = await loadContextTreeNode({
                directory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const resolvedNode: ResolvedNode = resolveNode(processedNode);
            const finalizedNode: ResolvedNode = await finalizeNode({
                node: resolvedNode,
                sourceDirectory: tempDir(),
            });

            const outputtedContents = await fs
                .readFile(
                    path.join(finalizedNode.stagingDirectory, "finalized"),
                )
                .then((val) => val.toString());
            const childOutput = await fs
                .readFile(
                    path.join(
                        finalizedNode.baseChildren[0].stagingDirectory,
                        "finalized",
                    ),
                )
                .then((val) => val.toString());
            expect(outputtedContents).toBe("hello world");
            expect(childOutput).toBe("aaaa");
        });
        it("should just copy if no source finalizers exist", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
            });

            const node: ContextTreeNode = await loadContextTreeNode({
                directory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const resolvedNode: ResolvedNode = resolveNode(processedNode);
            const finalizedNode: ResolvedNode = await finalizeNode({
                node: resolvedNode,
                sourceDirectory: tempDir(),
            });

            const outputtedContents = await fs
                .readFile(
                    path.join(finalizedNode.stagingDirectory, "finalized"),
                )
                .then((val) => val.toString());
            expect(outputtedContents).toBe("hello world");
        });
        it("should convert buffers into streams", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
                "tartan.context.json": JSON.stringify({
                    sourceProcessors: ["./processor-a.js", "./processor-b.js"],
                } as TartanContextFile),
                "processor-a.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceBuffer()
                    }
                }}`,
                "processor-b.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceStream()
                    }
                }}`,
            });

            const node: ContextTreeNode = await loadContextTreeNode({
                directory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const resolvedNode: ResolvedNode = resolveNode(processedNode);
            const finalizedNode: ResolvedNode = await finalizeNode({
                node: resolvedNode,
                sourceDirectory: tempDir(),
            });

            const outputtedContents = await fs
                .readFile(
                    path.join(finalizedNode.stagingDirectory, "finalized"),
                )
                .then((val) => val.toString());

            expect(outputtedContents).toBe("hello world");
        });
        it("should convert streams into buffers", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
                "tartan.context.json": JSON.stringify({
                    sourceProcessors: ["./processor-a.js", "./processor-b.js"],
                } as TartanContextFile),
                "processor-a.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceStream()
                    }
                }}`,
                "processor-b.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceBuffer()
                    }
                }}`,
            });

            const node: ContextTreeNode = await loadContextTreeNode({
                directory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const resolvedNode: ResolvedNode = resolveNode(processedNode);
            const finalizedNode: ResolvedNode = await finalizeNode({
                node: resolvedNode,
                sourceDirectory: tempDir(),
            });

            const outputtedContents = await fs
                .readFile(
                    path.join(finalizedNode.stagingDirectory, "finalized"),
                )
                .then((val) => val.toString());

            expect(outputtedContents).toBe("hello world");
        });

        it("should pipe outputs from source processor into finalizer", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
                "tartan.context.json": JSON.stringify({
                    sourceProcessors: ["./processor-a.js", "./processor-b.js"],
                } as TartanContextFile),
                "processor-a.js": `export default {process: async (input) => {
                    return {
                        processedContents: Buffer.from("hello guys welcome to my minecraft let's play")
                    }
                }}`,
                "processor-b.js": `export default {finalize: async (input) => {
                    const buffer = await input.getSourceBuffer().then(val => val.toString())
                    if (buffer !== "hello guys welcome to my minecraft let's play") {
                        throw "didn't pass stuff"
                    }
                    return buffer;
                }}`,
            });

            const node: ContextTreeNode = await loadContextTreeNode({
                directory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const resolvedNode: ResolvedNode = resolveNode(processedNode);
            const finalizedNode: ResolvedNode = await finalizeNode({
                node: resolvedNode,
                sourceDirectory: tempDir(),
            });

            const outputtedContents = await fs
                .readFile(
                    path.join(finalizedNode.stagingDirectory, "finalized"),
                )
                .then((val) => val.toString());

            expect(outputtedContents).toBe(
                "hello guys welcome to my minecraft let's play",
            );
        });
        it("should pass path params into source finalizers", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
                "tartan.context.json": JSON.stringify({
                    sourceProcessors: ["./processor.js?key=value"],
                } as TartanContextFile),
                "processor.js": `export default {finalize: async (input) => {
                    if (input.pathParameters.get("key") !== "value") {
                        throw "param wasn't passed properly"
                    }
                    return await input.getSourceStream()
                }}`,
            });

            const node: ContextTreeNode = await loadContextTreeNode({
                directory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
            });
            const resolvedNode: ResolvedNode = resolveNode(processedNode);
            const finalizedNode: ResolvedNode = await finalizeNode({
                node: resolvedNode,
                sourceDirectory: tempDir(),
            });
        });
    });

    it("should call the handoff handler if one exists", async () => {
        const tmpDir = await makeTempFiles({
            "source.txt": "hello world",
            "tartan.context.json": JSON.stringify({
                handoffHandler: "./handoff.js",
            } as TartanContextFile),
            "handoff.js": `import fs from "fs/promises"; import path from "path"; export default {finalize: async (input) => {
                await fs.writeFile(path.join(input.stagingDirectory, "finalized"), "hello world");
                return {};
            }}`,
        });

        const node: ContextTreeNode = await loadContextTreeNode({
            directory: tmpDir,
            rootContext: {
                pageMode: "directory",
                pageSource: "source.txt",
            },
        });
        const processedNode: ProcessedNode = await processNode({
            node: node,
            sourceDirectory: tmpDir,
            rootContext: {
                pageMode: "directory",
                pageSource: "source.txt",
            },
        });
        const resolvedNode: ResolvedNode = resolveNode(processedNode);
        const finalizedNode: ResolvedNode = await finalizeNode({
            node: resolvedNode,
            sourceDirectory: tempDir(),
        });

        expect(
            (
                await fs.readFile(
                    path.join(finalizedNode.stagingDirectory, "finalized"),
                )
            ).toString(),
        ).toBe("hello world");
    });
});
