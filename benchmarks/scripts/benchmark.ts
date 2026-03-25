import { nullLogger } from "../../spec/helpers/logs";
import { loadContextTreeNode, processNode } from "../../src";
import { FSCache } from "../../src/inputs/fs.js";

async function shallow() {
    const startCPU = process.cpuUsage();
    console.time("cache-populate");
    await FSCache.populateCache("benchmarks/benchmark-shallow");
    console.timeEnd("cache-populate");
    console.time("shallow-discover");
    const node = await loadContextTreeNode({
        directory: "benchmarks/benchmark-shallow",
        rootContext: {
            pageMode: "file",
            pagePattern: "*",
        },
        baseLogger: nullLogger,
    });
    console.timeEnd("shallow-discover");
    const discoverCPU = process.cpuUsage(startCPU);
    console.log(discoverCPU);

    console.time("shallow-process");
    const processed = await processNode({
        node,
        sourceDirectory: "benchmarks/benchmark-shallow",
        rootContext: {
            pageMode: "file",
            pagePattern: "*",
        },
        baseLogger: nullLogger,
    });
    console.timeEnd("shallow-process");
    const processCPU = process.cpuUsage(discoverCPU);
    console.log(processCPU);
}

await shallow();
