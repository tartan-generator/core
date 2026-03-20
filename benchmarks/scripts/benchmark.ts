import { nullLogger } from "../../spec/helpers/logs";
import { loadContextTreeNode } from "../../src";
import { FSCache } from "../../src/inputs/fs";

async function shallow() {
    const startCPU = process.cpuUsage();
    console.time("cache-populate");
    await FSCache.populateCache("benchmarks/benchmark-shallow");
    console.timeEnd("cache-populate");
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

    const endCPU = process.cpuUsage(startCPU);
    console.log(endCPU);
}

await shallow();
