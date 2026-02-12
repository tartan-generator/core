import fs from "fs/promises";
import path from "node:path";

beforeAll(async () => {
    await fs.rm(".tmp", {
        force: true,
        recursive: true,
    });
    await fs.mkdir(".tmp");
});

beforeEach(async () => {
    const tmpDir = path.resolve(await fs.mkdtemp(".tmp/tartan-test-"));
    process.env["TMP_DIR"] = tmpDir;
});
