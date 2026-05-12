import { initializeContext } from "../../src/inputs/context.js";
import { pathToFileURL } from "../../src/inputs/resolve.js";
import {
    PartialTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { makeTempFiles } from "../utils/filesystem.js";
import path from "node:path";
import { TartanInput } from "../../src/types/inputs.js";
import { nullLogger } from "../helpers/logs.js";

describe("The context initializer", () => {
    it("should load a source processor and handoff handler", async () => {
        const tmpDir = await makeTempFiles({
            // these are *not* the right format but I don't need them to be right now
            "processor.js": "export default {process: () => 42}",
            "handoff.js": "export default {process: () => 84}",
            "template.hbs": "{{test}}",
        });

        const context: TartanContextFile = {
            sourceProcessors: ["./processor.js"],
            handoffHandler: "./handoff.js",
        };

        const tartanContextFile: TartanInput<TartanContextFile> = {
            value: context,
            url: pathToFileURL(path.join(tmpDir, "tartan.context")),
            hash: "",
            type: "json",
        };
        const initialized: PartialTartanContext = await initializeContext(
            {
                "~source-directory": tmpDir,
            },
            tartanContextFile,
            nullLogger,
        );

        expect(initialized.sourceProcessors).toBeDefined();
        expect(initialized.handoffHandler).toBeDefined();
        // @ts-ignore
        expect(initialized.sourceProcessors[0].value.process()).toBe(42); // the answer to life the universe and everything
        // @ts-ignore
        expect(initialized.handoffHandler.value.process()).toBe(84); // twice the answer idk lol
    });
    it("should load the asset processors", async () => {
        const tmpDir = await makeTempFiles({
            "png.js": "export default () => 42",
            "jpg.js": "export default () => 21",
        });

        const context: TartanContextFile = {
            assetProcessors: {
                png: ["./png.js"],
                jpg: ["./jpg.js"],
            },
        };

        const contextFile: TartanInput<TartanContextFile> = {
            value: context,
            url: new URL(path.join(tmpDir, "tartan.context"), "file://"),
            hash: "",
            type: "json",
        };
        const initialized: PartialTartanContext = await initializeContext(
            {
                "~source-directory": tmpDir,
            },
            contextFile,
            nullLogger,
        );

        expect(initialized.assetProcessors).toBeDefined();
        expect(initialized.assetProcessors).toEqual({
            png: [jasmine.objectContaining({ value: jasmine.any(Function) })],
            jpg: [jasmine.objectContaining({ value: jasmine.any(Function) })],
        });
        expect(
            (
                initialized.assetProcessors as Record<
                    string,
                    TartanInput<Function>[]
                >
            ).png[0].value(),
        ).toBe(42);
        expect(
            (
                initialized.assetProcessors as Record<
                    string,
                    TartanInput<Function>[]
                >
            ).jpg[0].value(),
        ).toBe(21);
    });
});
