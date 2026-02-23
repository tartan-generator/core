import { makeTempFile, updateTempFile } from "../utils/filesystem.js";
import { loadModule } from "../../src/inputs/module.js";
import path from "node:path";
import { nullLogger } from "../helpers/logs.js";

describe("The module loader", () => {
    it("should load a module, once", async () => {
        const testFile: string = await makeTempFile(
            "test.ts",
            "export default 10",
        );
        const module = await loadModule<number>(
            new URL(path.resolve(testFile), "file://"),
            nullLogger,
        );

        expect(module.value).toBe(10);
    });
    it("should handle imports", async () => {
        const dep: string = await makeTempFile("dep.ts", "export default 50");
        const main: string = await makeTempFile(
            "main.ts",
            `import num from "${dep}"; export default num;`,
        );

        const result = await loadModule<number>(
            new URL(path.resolve(main), "file://"),
            nullLogger,
        ).then((val) => val.value);

        expect(result).toBe(50);
    });
    it("shouldn't cache file imports", async () => {
        const dep: string = await makeTempFile("dep.ts", "export default 50");
        const main: string = await makeTempFile(
            "main.ts",
            `import num from "${dep}"; export default num;`,
        );

        const result = await loadModule<number>(
            new URL(path.resolve(main), "file://"),
            nullLogger,
        ).then((val) => val.value);

        expect(result).toBe(50);

        await updateTempFile("dep.ts", "export default 25");
        const newResult = await loadModule<number>(
            new URL(path.resolve(main), "file://"),
            nullLogger,
        ).then((val) => val.value);

        expect(newResult).toBe(25);
    });
    it("shouldn't hang when it's an async function", async () => {
        // idk what this test is about imma be real
        const file = await makeTempFile(
            "test.js",
            "export default () => Promise.resolve()",
        );
        const func = await loadModule<() => Promise<void>>(
            new URL(path.resolve(file), "file://"),
            nullLogger,
        ).then((val) => val.value);

        return expectAsync(func()).toBeResolved();
    });
});
