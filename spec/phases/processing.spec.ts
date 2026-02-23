import { loadContextTreeNode } from "../../src/phases/discovery.js";
import { processNode } from "../../src/phases/processing.js";
import { ContextTreeNode, ProcessedNode } from "../../src/types/nodes.js";
import { getTempFile, makeTempFiles } from "../utils/filesystem.js";
import fs from "fs/promises";
import path from "path";
import { TartanContextFile } from "../../src/types/tartan-context.js";
import { nullLogger } from "../helpers/logs.js";

describe("The node processor", () => {
    describe("when executing source processors", () => {
        it("should resolve page source using path prefixes", async () => {
            process.env["ASDF"] = "yes";
            const prefixContext = (prefixPath: string): string =>
                JSON.stringify({
                    pathPrefixes: { "~prefix": prefixPath },
                } as TartanContextFile);
            const tmpDir = await makeTempFiles({
                "src/tartan.context.json": prefixContext("../sources/"),
                "sources/index.md": "source uwu",
                "src/child/tartan.context.json": JSON.stringify({
                    pageSource: "~source-directory/../sources/index.md",
                }),
            });
            const node = await loadContextTreeNode({
                directory: path.join(tmpDir, "src"),
                rootContext: {
                    pageMode: "directory",
                    pageSource: "~prefix/index.md",
                },
                baseLogger: nullLogger,
            });
            const processed = await processNode({
                node,
                rootContext: {
                    pageMode: "directory",
                    pageSource: "nomatter",
                },
                sourceDirectory: path.join(tmpDir, "src"),
                baseLogger: nullLogger,
            });
            const baseSource: string = await fs
                .readFile(path.join(processed.stagingDirectory, "processed"))
                .then((val) => val.toString());
            const childSource: string = await fs
                .readFile(
                    path.join(
                        processed.baseChildren[0].stagingDirectory,
                        "processed",
                    ),
                )
                .then((val) => val.toString());
            process.env["ASDF"] = "no";
            expect(baseSource).toBe("source uwu");
            expect(childSource).toBe("source uwu");
        });
        it("should resolve dependencies using path prefixes", async () => {
            const tmpDir = await makeTempFiles({
                "processor/process.js": `export default {process: async (input) => {
                    return {
                        processedContents: await input.getSourceStream(),
                        dependencies: ["~source-processor/test.txt", "~source-directory/b.txt", "~this-node/a.txt"] // I can't test ~node-module easily, but tbf that's not a path prefix like the others.

                    }
                }}`,
                "processor/test.txt": "hewwo wold",
                "src/index.md": "asdlkfa",
                "src/tartan.context.json": JSON.stringify({
                    sourceProcessors: [
                        "~source-directory/../processor/process.js",
                    ],
                } as TartanContextFile),
                "src/a.txt": "asdfk",
                "src/b.txt": "none of the content matterssssssssssssss",
            });

            const node = await loadContextTreeNode({
                directory: path.join(tmpDir, "src"),
                rootContext: {
                    pageMode: "directory",
                    pageSource: "index.md",
                },
                baseLogger: nullLogger,
            });
            const processedNode = await processNode({
                node,
                sourceDirectory: path.join(tmpDir, "src"),
                rootContext: { pageMode: "directory", pageSource: "index.md" },
                baseLogger: nullLogger,
            });

            expect(processedNode.derivedChildren).toHaveSize(3);
            expect(processedNode.derivedChildren).toEqual(
                jasmine.arrayWithExactContents([
                    jasmine.objectContaining({
                        path: "../processor/test.txt",
                    }),
                    jasmine.objectContaining({
                        path: "a.txt",
                    }),
                    jasmine.objectContaining({
                        path: "b.txt",
                    }),
                ]),
            );
        });
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

        expect(
            (
                await fs.readFile(
                    path.join(processedNode.stagingDirectory, "processed"),
                )
            ).toString(),
        ).toBe("hello world");
    });
});
