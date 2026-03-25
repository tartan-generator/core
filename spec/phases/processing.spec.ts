import { loadContextTreeNode } from "../../src/phases/discovery.js";
import { processNode } from "../../src/phases/processing.js";
import { ContextTreeNode, ProcessedNode } from "../../src/types/nodes.js";
import { getTempFile, makeTempFiles } from "../utils/filesystem.js";
import fs from "fs/promises";
import path from "path";
import {
    FullTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { nullLogger } from "../helpers/logs.js";
import { pathToFileURL } from "../../src/inputs/resolve.js";
import { Minimatch } from "minimatch";

describe("The node processor", () => {
    it("should mark derived nodes as being derived", async () => {
        const tmpDir = await makeTempFiles({
            "src/processor.js": `export default {process: async (input) => {
                return {
                    processedContents: await input.getSourceStream(),
                    dependencies: ["a"]

                }
            }}`,
            "src/index.md": "asdlkfa",
            "src/tartan.context.json": JSON.stringify({
                sourceProcessors: ["processor.js"],
            } as TartanContextFile),
            "src/a": "none of the content matterssssssssssssss",
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

        expect(processedNode.children[0].derived).toBe(true);
    });
    describe("when executing source processors", () => {
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
                rootContext: {
                    pageMode: "asset",
                    pagePattern: new Minimatch("*"),
                },
                baseLogger: nullLogger,
            });
            const processed: ProcessedNode = await processNode({
                node,
                sourceDirectory: tmpDir,
                rootContext: {} as FullTartanContext,
                baseLogger: nullLogger,
            });

            expect(processed.children[0].children[0].outputPath).toBe("image");
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
                            process: async (input) => {
                                const buffer = await input.getSourceBuffer();
                                if (buffer.length !== 0) throw "bad buffer";
                                return {
                                    processedContents: buffer,
                                };
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
                            process: async (input) => {
                                const stream = await input.getSourceStream();
                                if (stream.read() !== null) throw "bad buffer";
                                return {
                                    processedContents: stream,
                                };
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
                            process: async (input) => {
                                const stream = await input.getSourceStream();
                                if (stream.read() !== null) throw "bad buffer";
                                return {
                                    processedContents: stream,
                                };
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

            const exists: boolean = await fs
                .access(path.join(processed.stagingDirectory, "processed"))
                .then(() => true)
                .catch(() => false);

            expect(exists).toBe(false);
        });

        it("should resolve source file properly for all nodes", async () => {
            const tmpDir = await makeTempFiles({
                "src/index.md": "source uwu",
                "src/child/index.md": "child owo",
            });
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.md",
            };
            const node = await loadContextTreeNode({
                directory: path.join(tmpDir, "src"),
                rootContext,
                baseLogger: nullLogger,
            });
            const processed = await processNode({
                node,
                rootContext,
                sourceDirectory: path.join(tmpDir, "src"),
                baseLogger: nullLogger,
            });
            const baseSource: string = await fs
                .readFile(path.join(processed.stagingDirectory, "processed"))
                .then((val) => val.toString());
            const childSource: string = await fs
                .readFile(
                    path.join(
                        processed.children[0].stagingDirectory,
                        "processed",
                    ),
                )
                .then((val) => val.toString());
            expect(baseSource).toBe("source uwu");
            expect(childSource).toBe("child owo");
        });
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
                        processed.children[0].stagingDirectory,
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

            expect(processedNode.children).toHaveSize(3);
            expect(processedNode.children).toEqual(
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
            expect(processedNode.children).toHaveSize(2);
            expect(processedNode.children).toEqual(
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
