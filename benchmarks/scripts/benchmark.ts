import { nullLogger } from "../../spec/helpers/logs";
import { loadContextTreeNode } from "../../src";

async function shallow() {
    console.time("shallow");
    await loadContextTreeNode({
        directory: "benchmarks/benchmark-shallow",
        rootContext: {
            pageMode: "file",
            pagePattern: "*",
        },
        baseLogger: nullLogger,
    });
    console.timeEnd("shallow");
}

await shallow();
