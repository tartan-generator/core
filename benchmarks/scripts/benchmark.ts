import { nullLogger } from "../../spec/helpers/logs";
import {
    finalizeNode,
    loadContextTreeNode,
    outputNode,
    processNode,
    resolveNode,
} from "../../src";
import { FSCache } from "../../src/inputs/fs";
import { Minimatch } from "minimatch";

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
            pagePattern: new Minimatch("*"),
        },
        baseLogger: nullLogger,
    });
    console.timeEnd("shallow-discover");
    const discoverCPU = process.cpuUsage(startCPU);
    console.log(discoverCPU);

    /*
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

    console.time("shallow-resolve");
    const resolved = resolveNode(processed);
    console.timeEnd("shallow-resolve");
    const resolveCPU = process.cpuUsage(processCPU);
    console.log(resolveCPU);

    console.time("shallow-finalize");
    const finalized = await finalizeNode({
        node: resolved,
        sourceDirectory: "benchmarks/benchmark-shallow",
    });
    console.timeEnd("shallow-finalize");
    const finalizeCPU = process.cpuUsage(resolveCPU);
    console.log(resolveCPU);

    console.time("shallow-output");
    const outputted = await outputNode(
        finalized,
        "benchmarks/benchmark-shallow-output",
    );
    console.timeEnd("shallow-output");
    const outputCPU = process.cpuUsage(finalizeCPU);
    console.log(outputCPU);
    */
}

await shallow();
