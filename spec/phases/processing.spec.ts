import { loadContextTreeNode } from "../../src/phases/discovery.js";
import { processNode } from "../../src/phases/processing.js";
import { ContextTreeNode, ProcessedNode } from "../../src/types/nodes.js";
import { getTempFile, makeTempFiles } from "../utils/filesystem.js";
import fs from "fs/promises";
import path from "path";
import { TartanContextFile } from "../../src/types/tartan-context.js";

describe("The node processor", () => {
    describe("when executing source processors", () => {
        it("should just copy if no source processors exist", async () => {
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

            const outputtedContents = await fs
                .readFile(
                    path.join(processedNode.stagingDirectory, "processed"),
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

            const outputtedContents = await fs
                .readFile(
                    path.join(processedNode.stagingDirectory, "processed"),
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

            const outputtedContents = await fs
                .readFile(
                    path.join(processedNode.stagingDirectory, "processed"),
                )
                .then((val) => val.toString());
            expect(outputtedContents).toBe("hello world");
        });

        it("should handle cumulative properties", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
                "tartan.context.json": JSON.stringify({
                    sourceProcessors: [
                        "./processor-a.js",
                        "./processor-b.js",
                        "./processor-c.js",
                    ],
                } as TartanContextFile),
                "processor-a.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceStream(),
                        sourceMetadata: {a: "value"},
                        outputPath: "nonfinalpath",
                        dependencies: ["./a.png"],
                    }
                }}`,
                "processor-b.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceStream(),
                        sourceMetadata: {a: "newvalue", b: "value"},
                        outputPath: "finalpath",
                        dependencies: ["./a.png", "./b.png"],
                    }
                }}`,
                "processor-c.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceStream(),
                    }
                }}`,
                "a.png": "",
                "b.png": "",
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

            expect(processedNode.metadata).toEqual({
                a: "newvalue",
                b: "value",
            });
            expect(processedNode.outputPath).toBe("finalpath");
            expect(processedNode.derivedChildren).toHaveSize(2);
            expect(processedNode.derivedChildren).toEqual(
                jasmine.arrayContaining([
                    jasmine.objectContaining({
                        path: "a.png",
                    }),
                    jasmine.objectContaining({
                        path: "b.png",
                    }),
                ]),
            );
        });
        it("should pass path params into source processors", async () => {
            const tmpDir = await makeTempFiles({
                "source.txt": "hello world",
                "tartan.context.json": JSON.stringify({
                    sourceProcessors: ["./processor.js?key=value"],
                } as TartanContextFile),
                "processor.js": `export default {process: async (input) => {
                    if (input.pathParameters.get("key") !== "value") {
                        throw "param wasn't passed properly"
                    }
                    return {
                        processedContents: await input.getSourceStream(),
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
        });
    });

    it("should call the handoff handler if one exists", async () => {
        const tmpDir = await makeTempFiles({
            "source.txt": "hello world",
            "tartan.context.json": JSON.stringify({
                handoffHandler: "./handoff.js",
            } as TartanContextFile),
            "handoff.js": `import fs from "fs/promises"; import path from "path"; export default {process: async (input) => {
                await fs.writeFile(path.join(input.stagingDirectory, "processed"), "hello world");
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

        expect(
            (
                await fs.readFile(
                    path.join(processedNode.stagingDirectory, "processed"),
                )
            ).toString(),
        ).toBe("hello world");
    });
});
