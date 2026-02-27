import { loadContextTreeNode } from "../../src/phases/discovery.js";
import {
    FullTartanContext,
    PartialTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import {
    tempDir,
    makeTempFile,
    makeTempFiles,
    removeTempFile,
    updateTempFile,
} from "../utils/filesystem.js";
import { ContextTreeNode } from "../../src/types/nodes.js";
import path from "path";
import { nullLogger } from "../helpers/logs.js";

describe("The context tree loader", () => {
    it("should treat `directory` as the root directory when `rootDirectory` is undefined", async () => {
        const rootContext: FullTartanContext = {
            pageMode: "directory",
            pageSource: "index.html",
        };
        const tmpDir = await makeTempFiles({
            "tartan.context.js": 'export default {pageSource: "uwu.md"}',
            "child/dummy": "",
        });
        const node = await loadContextTreeNode({
            directory: tmpDir,
            rootContext,
            baseLogger: nullLogger,
        });
        expect(node.path).toBe(".");
        expect(node.children[0].path).toBe("child");
    });
    describe("when loading context objects", () => {
        it("should resolve paths using path prefixes", async () => {
            await makeTempFile(
                "tartan.context.json",
                JSON.stringify({
                    pathPrefixes: {
                        "~test": "~source-directory/prefix",
                        "~test2": "./noprefix",
                    },
                    sourceProcessors: ["~test/processor.js"],
                } as TartanContextFile),
            );
            await makeTempFile("prefix/processor.js", "export default {}");

            const node = await loadContextTreeNode({
                directory: tempDir(),
                rootContext: {
                    pageMode: "directory",
                    pageSource: "doesntmatter",
                },
                baseLogger: nullLogger,
            });

            expect(node.context.pathPrefixes?.["~test"]).toBe(
                path.join(tempDir(), "prefix"),
            );
            expect(node.context.pathPrefixes?.["~test2"]).toBe(
                path.join(tempDir(), "noprefix"),
            );
            expect(node.context.sourceProcessors?.[0].url.pathname).toBe(
                path.join(tempDir(), "prefix", "processor.js"),
            );
        });
        it("should load a module context", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.html",
            };
            const tmpDir = await makeTempFiles({
                "tartan.context.js": 'export default {pageSource: "uwu.md"}',
            });
            const node = await loadContextTreeNode({
                directory: tmpDir,
                rootContext,
                baseLogger: nullLogger,
            });

            expect(node.context).toEqual({
                pageMode: "directory",
                pageSource: "uwu.md",
            });
        });
        it("should return the root context when no context files are on disk", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "yourmom.html",
            };
            const node = await loadContextTreeNode({
                directory: tempDir(),
                rootContext,
                baseLogger: nullLogger,
            });

            expect(node.context).toEqual(rootContext);
        });
        it("should overlay a local context file on the root context", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "fuck.html",
            };
            const localContextFile: PartialTartanContext = {
                pageSource: "chickennugget.html",
            };
            const expectedResult: FullTartanContext = {
                pageMode: "directory",
                pageSource: "chickennugget.html",
            };

            await makeTempFile(
                "tartan.context.json",
                JSON.stringify(localContextFile),
            );

            const node = await loadContextTreeNode({
                directory: tempDir(),
                rootContext,
                baseLogger: nullLogger,
            });
            expect(node.context).toEqual(expectedResult);
        });
        it("should use a default context file as both inheritable and local contexts", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.html",
            };
            const defaultContextFile: PartialTartanContext = {
                pageSource: "overridden.uwu",
            };

            await makeTempFile(
                "tartan.context.default.json",
                JSON.stringify(defaultContextFile),
            );

            const node = await loadContextTreeNode({
                directory: tempDir(),
                rootContext,
                baseLogger: nullLogger,
            });

            const expectedOutput: FullTartanContext = {
                pageMode: "directory",
                pageSource: "overridden.uwu",
            };
            expect(node.inheritableContext).toEqual(expectedOutput);
            expect(node.context).toEqual(expectedOutput);
        });
        it("should inherit context from a parent if provided", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "aldkfjnaslkdjfn",
            };

            const parentContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.html",
            };

            const childNode = await loadContextTreeNode({
                directory: tempDir(),
                parentContext: parentContext,
                rootContext,
                baseLogger: nullLogger,
            });

            const childContext = childNode.context;
            expect(childContext).toEqual({
                pageMode: "directory",
                pageSource: "index.html",
            });
        });
        it("should override parent context when parent is provided", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "aldkfjnaslkdjfn",
            };
            const inheritableContext: FullTartanContext = {
                pageMode: "directory",
                pageSource: "index.html",
            };
            await makeTempFile(
                "tartan.context.json",
                JSON.stringify({
                    pageSource: "index.md",
                }),
            );

            const childNode = await loadContextTreeNode({
                directory: tempDir(),
                parentContext: inheritableContext,
                rootContext,
                baseLogger: nullLogger,
            });

            expect(childNode.context).toEqual({
                pageMode: "directory",
                pageSource: "index.md",
            });
        });
    });

    // Loading children
    describe("when loading children", () => {
        it("should use the pagePattern from local context, not parent context", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "file",
                pageSource: "index.md",
                pagePattern: "*",
            };

            const tmpDir = await makeTempFiles({
                "a/tartan.context.json": JSON.stringify(<TartanContextFile>{
                    pageMode: "file",
                    pagePattern: "*.md",
                }),
                "a/file.md": "child",
                "a/file.nomatch": "not a child",

                "b/tartan.context.json": JSON.stringify(<TartanContextFile>{
                    pageMode: "file",
                    pagePattern: "*.md",
                }),
                "b/file.md": "child",
                "b/file.nomatch": "not a child",
            });

            const a = await loadContextTreeNode({
                directory: path.join(tmpDir, "a"),
                rootContext,
                baseLogger: nullLogger,
            });
            const b = await loadContextTreeNode({
                directory: path.join(tmpDir, "b"),
                rootContext,
                baseLogger: nullLogger,
            });

            expect(a.children).toHaveSize(1);
            expect(b.children).toHaveSize(1);
        });
        it("should ignore context files when they match pagePattern", async () => {
            const rootContext: FullTartanContext = {
                pageMode: "file",
                pageSource: "index.md",
                pagePattern: "*",
            };

            const tmpDir = await makeTempFiles({
                "a/tartan.context.json": "{}",
                "a/tartan.context.default.json": "{}",
                "a/child.md": "I'm a child uwuwuwuwuwu",
                "b/child.md": " waow",
                "b/tartan.context.default.json": "{}",
                "b/tartan.context.json": JSON.stringify(<TartanContextFile>{
                    pageMode: "asset",
                    pagePattern: "*",
                }),
            });

            const a = await loadContextTreeNode({
                directory: path.join(tmpDir, "a"),
                rootContext,
                baseLogger: nullLogger,
            });
            const b = await loadContextTreeNode({
                directory: path.join(tmpDir, "b"),
                rootContext,
                baseLogger: nullLogger,
            });

            expect(a.children).toHaveSize(1);
            expect(b.children).toHaveSize(1);
        });
        describe("when `pageMode` is `directory`", () => {
            it("should load child and initialize contexts", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "directory",
                    pageSource: "index.html",
                };
                const tmpDir = await makeTempFiles({
                    "index.html": "aldjkfnjdn", // contents don't matter
                    "child/index.md": "adlskjfnasldk",
                    "child/tartan.context.json": JSON.stringify({
                        pageSource: "index.md",
                    }),
                    "subdir/index.txt": "adksjfnkjnncadsjnjk",
                    "subdir/tartan.context.json": JSON.stringify({
                        pageSource: "index.txt",
                    }),
                });

                const node = await loadContextTreeNode({
                    directory: path.join(tmpDir),
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.inheritableContext).toEqual(rootContext);

                const children: ContextTreeNode[] = node.children;
                expect(children).toHaveSize(2);

                const childContexts: FullTartanContext[] = children.map(
                    (child) => child.context,
                );

                expect(childContexts).toEqual(
                    jasmine.arrayWithExactContents([
                        {
                            pageMode: "directory",
                            pageSource: "index.md",
                        },
                        { pageMode: "directory", pageSource: "index.txt" },
                    ] as FullTartanContext[]),
                );
            });
        });
        describe("when `pageMode` is `file`", () => {
            it("should load children", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "test.md": "hewwo world",
                    "nibbledoober.md": "haiii kawaii uwu",
                });
                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(2);
            });
            it("should give children the proper type", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "test.md": "asdfjjjcnaksjdn",
                });
                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children[0].type).toBe("page.file");
            });
            it("should still add sub directories as children", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "first.md": "asdflkjncksjan",
                    "second.md": "adkfnasdlknnncaklsdjnlka",
                    "sub-dir/poo.md": "adkfjlkncnl",
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(3);
            });
            it("shouldn't add unmatching files as children", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };
                const tmpDir = await makeTempFiles({
                    "file.md": "uwu",
                    "ignored.txt": "ignore me uwu :3",
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(1);
            });
            it("shouldn't add the file matched by `pageSource` as a child, even if it would otherwise be matched by `pagePattern`", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pageSource: "index.md",
                    pagePattern: "*.md",
                };

                const tmpDir = await makeTempFiles({
                    "index.md": "I'm not a child >:3",
                    "child.md": "I'm a child uwuwuwuwuwu",
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(1);
            });
        });
        describe("when `pageMode` is `asset`", () => {
            it("should load only matching files as assets", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pagePattern: "*.png",
                };
                const tmpDir = await makeTempFiles({
                    "one.png": "definteily png aatatddat",
                    "two.png": "aslos for sure png hmm",
                    "notapng.notpng": "wow lok im not a png",
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(2);
            });
            it("should still load sub directory as a child", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pagePattern: "*.png",
                };
                const tmpDir = await makeTempFiles({
                    "one.png": "adljnlkjasndf",
                    "two.png": "skdlafjnsd",
                    "child-dir/asdfkj.doesn;tatmtma": "asdf",
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(3);
            });
            it("should ignore the file matched by `pageSource`", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "asset",
                    pageSource: "index.md",
                    pagePattern: "*.md",
                };

                const tmpDir = await makeTempFiles({
                    "index.md": "I'm not a child >:3",
                    "child.md": "I'm a child uwuwuwuwuwu",
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(1);
            });
        });
        describe("when `pageMode` is `handoff`", () => {
            it("should set the node type to be `handoff`", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "directory",
                    pageSource: "index.html",
                };

                const localContext: TartanContextFile = {
                    pageMode: "handoff",
                };

                const tmpDir = await makeTempFiles({
                    "tartan.context.json": JSON.stringify(localContext),
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.type).toBe("handoff");
            });
            it("should set the node type to be `handoff.file` if the context that declares handoff is for a file", async () => {
                const rootContext: FullTartanContext = {
                    pageMode: "file",
                    pagePattern: "*.md",
                };

                const localContext: TartanContextFile = {
                    pageMode: "handoff",
                };

                const tmpDir = await makeTempFiles({
                    "test.md": "uwu",
                    "test.md.context.json": JSON.stringify(localContext),
                });

                const node = await loadContextTreeNode({
                    directory: tmpDir,
                    rootContext,
                    baseLogger: nullLogger,
                });

                expect(node.children).toHaveSize(1);
                expect(node.children[0].type).toBe("handoff.file");
            });
        });
    });
});
