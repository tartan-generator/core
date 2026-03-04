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
import {
    FullTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { resolveNode } from "../../src/phases/resolving.js";
import { finalizeNode } from "../../src/phases/finalizing.js";
import { nullLogger } from "../helpers/logs.js";
import { pathToFileURL } from "../../src/inputs/resolve.js";

describe("The node finalizer", () => {
    describe("when executing source finalizers", () => {
        it("should match asset processors by basename", async () => {
            const tmpDir: string = await makeTempFiles({
                "sub/asset.ass": "helo wold",
                "sub/asset.ass.context.json": JSON.stringify(<
                    TartanContextFile
                >{
                    assetProcessors: {
                        "*.ass": ["./processor.js"],
                    },
                }),
                "sub/processor.js": `
                export default {process: async (params) => ({
                    processedContents: Buffer.from("hello world"),
                    outputPath: "image"
                })}`,
            });

            const node: ContextTreeNode = await loadContextTreeNode({
                directory: tmpDir,
                rootContext: { pageMode: "asset", pagePattern: "*" },
                baseLogger: nullLogger,
            });
            const processed: ProcessedNode = await processNode({
                node,
                sourceDirectory: tmpDir,
                rootContext: {} as FullTartanContext,
                baseLogger: nullLogger,
            });

            expect(processed.baseChildren[0].baseChildren[0].outputPath).toBe(
                "image",
            );
        });
        it("should pass a null buffer for source if type is `container`", async () => {
            const tmpDir = await makeTempFiles({
                index: "hello world",
            });

            const rootContext: FullTartanContext = {
                pageMode: "container",
                pageSource: "index",
                sourceProcessors: [
                    {
                        url: pathToFileURL("meow"),
                        value: {
                            finalize: async (input) => {
                                const buffer = await input.getSourceBuffer();
                                if (buffer.length !== 0) throw "bad buffer";
                                return buffer;
                            },
                        },
                    },
                ],
            };
            const node = await loadContextTreeNode({
                directory: tmpDir,
                rootContext,
                baseLogger: nullLogger,
            });
            const processed = await processNode({
                node,
                rootContext,
                sourceDirectory: tmpDir,
                baseLogger: nullLogger,
            });
            const resolved = resolveNode(processed);
            const finalized = await finalizeNode({
                node: resolved,
                sourceDirectory: tmpDir,
            });

            // no expect needed, we just need this all to run without erroring
        });
        it("should pass a null stream for source if type is `container`", async () => {
            const tmpDir = await makeTempFiles({
                index: "hello world",
            });

            const rootContext: FullTartanContext = {
                pageMode: "container",
                pageSource: "index",
                sourceProcessors: [
                    {
                        url: pathToFileURL("meow"),
                        value: {
                            finalize: async (input) => {
                                const stream = await input.getSourceStream();
                                if (stream.read() !== null) throw "bad buffer";
                                return stream;
                            },
                        },
                    },
                ],
            };
            const node = await loadContextTreeNode({
                directory: tmpDir,
                rootContext,
                baseLogger: nullLogger,
            });
            const processed = await processNode({
                node,
                rootContext,
                sourceDirectory: tmpDir,
                baseLogger: nullLogger,
            });
            const resolved = resolveNode(processed);
            const finalized = await finalizeNode({
                node: resolved,
                sourceDirectory: tmpDir,
            });

            // no expect needed, we just need this all to run without erroring
        });
        it("shouldn't write to staging dir if type is container", async () => {
            const tmpDir = await makeTempFiles({
                index: "hello world",
            });

            const rootContext: FullTartanContext = {
                pageMode: "container",
                pageSource: "index",
                sourceProcessors: [
                    {
                        url: pathToFileURL("meow"),
                        value: {
                            finalize: async (input) => {
                                const stream = await input.getSourceStream();
                                if (stream.read() !== null) throw "bad buffer";
                                return stream;
                            },
                        },
                    },
                ],
            };
            const node = await loadContextTreeNode({
                directory: tmpDir,
                rootContext,
                baseLogger: nullLogger,
            });
            const processed = await processNode({
                node,
                rootContext,
                sourceDirectory: tmpDir,
                baseLogger: nullLogger,
            });
            const resolved = resolveNode(processed);
            const finalized = await finalizeNode({
                node: resolved,
                sourceDirectory: tmpDir,
            });

            const exists: boolean = await fs
                .access(path.join(processed.stagingDirectory, "finalized"))
                .then(() => true)
                .catch(() => false);

            expect(exists).toBe(false);
        });
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
                baseLogger: nullLogger,
            });

            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
                baseLogger: nullLogger,
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
                baseLogger: nullLogger,
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
                baseLogger: nullLogger,
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
                baseLogger: nullLogger,
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
                baseLogger: nullLogger,
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
                baseLogger: nullLogger,
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
                baseLogger: nullLogger,
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
                baseLogger: nullLogger,
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
                baseLogger: nullLogger,
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
                baseLogger: nullLogger,
            });
            const processedNode: ProcessedNode = await processNode({
                node: node,
                sourceDirectory: tmpDir,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "source.txt",
                },
                baseLogger: nullLogger,
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
            baseLogger: nullLogger,
        });
        const processedNode: ProcessedNode = await processNode({
            node: node,
            sourceDirectory: tmpDir,
            rootContext: {
                pageMode: "directory",
                pageSource: "source.txt",
            },
            baseLogger: nullLogger,
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
