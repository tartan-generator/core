import { loadObject } from "../../src/inputs/file-object.js";
import { nullLogger } from "../helpers/logs.js";
import { makeTempFile, tempDir } from "../utils/filesystem.js";
import path from "node:path";
import fs from "fs/promises";

describe("The file object loader", () => {
    it("should load explicit filepaths", async () => {
        const obj = {
            key: "wow a value that's so cool omg",
        };
        const filename = await makeTempFile("object.json", JSON.stringify(obj));
        const result = await loadObject(filename, {}, nullLogger, true);
        expect(result.value).toEqual(obj);
    });
    it("should return default when given explicit filepath that doesn't exist", async () => {
        const defaultObject = {};
        const result = await loadObject(
            path.join(tempDir(), "nonexistent"),
            defaultObject,
            nullLogger,
            true,
        );
        expect(result.value).toBe(defaultObject); // strict equality check, should be the exact same object, not just same structure
    });
    it("should return default when given explicit filepath that's a directory", async () => {
        const filepath = path.join(tempDir(), "test.json");
        await fs.mkdir(filepath);
        const obj = {};
        const result = await loadObject(filepath, obj, nullLogger, true);
        expect(result.value).toBe(obj);
    });
    it("should error when given an explicit filepath with an incompatible file extension", async () => {
        const filename = await makeTempFile("badextension.xyz", "");
        return expectAsync(
            loadObject(filename, {}, nullLogger, true),
        ).toBeRejected();
    });
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
