import { loadObject } from "../../src/inputs/file-object.js";
import { nullLogger } from "../helpers/logs.js";
import { makeTempFile, tempDir } from "../utils/filesystem.js";
import path from "node:path";

describe("The file object loader", () => {
    it("should load from a JSON file", async () => {
        const object = {
            key: "value",
        };
        const filename = await makeTempFile(
            "file.json",
            JSON.stringify(object),
        );
        const parsedFilename = path.parse(filename);

        const result = await loadObject(
            path.join(parsedFilename.dir, parsedFilename.name),
            {},
            nullLogger,
        );
        expect(result.value).toEqual(object);
    });
    it("should load from a TS file", async () => {
        const object = {
            key: "value",
        };
        const filename = await makeTempFile(
            "object.ts",
            `export default ${JSON.stringify(object)}`,
        );
        const parsedFilename = path.parse(filename);

        const result = await loadObject(
            path.join(parsedFilename.dir, parsedFilename.name),
            {},
            nullLogger,
        );

        expect(result.value).toEqual(object);
    });
    it("should prioritize TS over JSON", async () => {
        const object = {
            key: "value",
        };
        const ignoredJSON = await makeTempFile(
            "object.json",
            JSON.stringify({}),
        );
        const filename = await makeTempFile(
            "object.ts",
            `export default ${JSON.stringify(object)}`,
        );
        const parsedFilename = path.parse(filename);

        const result = await loadObject(
            path.join(parsedFilename.dir, parsedFilename.name),
            {},
            nullLogger,
        );

        expect(result.value).toEqual(object);
    });
    it("should use the default when provided", async () => {
        const defaultObject = {
            key: "value",
        };

        const result = await loadObject(
            path.join(tempDir(), "not-a-real-basename"),
            defaultObject,
            nullLogger,
        );

        expect(result.value).toEqual(defaultObject);
    });
});
