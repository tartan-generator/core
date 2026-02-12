import { initializeContext } from "../../src/inputs/context.js";
import { pathToFileURL } from "../../src/inputs/resolve.js";
import {
    PartialTartanContext,
    TartanContextFile,
} from "../../src/types/tartan-context.js";
import { makeTempFiles } from "../utils/filesystem.js";
import path from "node:path";
import { TartanInput } from "../../src/types/inputs.js";

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

        const tartanContextFile = {
            value: context,
            url: pathToFileURL(path.join(tmpDir, "tartan.context")),
        };
        const initialized: TartanInput<PartialTartanContext> =
            await initializeContext(tmpDir, tartanContextFile);

        expect(initialized.value.sourceProcessors).toBeDefined();
        expect(initialized.value.handoffHandler).toBeDefined();
        // @ts-ignore
        expect(initialized.value.sourceProcessors[0].value.process()).toBe(42); // the answer to life the universe and everything
        // @ts-ignore
        expect(initialized.value.handoffHandler.value.process()).toBe(84); // twice the answer idk lol
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
        };
        const initialized: TartanInput<PartialTartanContext> =
            await initializeContext(tmpDir, contextFile);

        expect(initialized.value.assetProcessors).toBeDefined();
        expect(initialized.value.assetProcessors).toEqual({
            png: [jasmine.objectContaining({ value: jasmine.any(Function) })],
            jpg: [jasmine.objectContaining({ value: jasmine.any(Function) })],
        });
        expect(
            (
                initialized.value.assetProcessors as Record<
                    string,
                    TartanInput<Function>[]
                >
            ).png[0].value(),
        ).toBe(42);
        expect(
            (
                initialized.value.assetProcessors as Record<
                    string,
                    TartanInput<Function>[]
                >
            ).jpg[0].value(),
        ).toBe(21);
    });
});
