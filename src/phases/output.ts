import { ResolvedNode } from "../types/nodes.js";
import fs from "fs/promises";
import path from "node:path";

/**
 * Output all the finalized files of this node and it's children into the output directory.
 *
 * @argument node The node to output.
 * @argument outputDirectory The root output directory.
 */
export async function outputNode(
    node: ResolvedNode,
    outputDirectory: string,
): Promise<ResolvedNode> {
    if (node.type === "page" || node.type === "page.file") {
        await fs.mkdir(path.join(path.join(outputDirectory, node.outputPath)), {
            recursive: true,
        });
        await fs.copyFile(
            path.join(node.stagingDirectory, "finalized"),
            path.join(outputDirectory, node.outputPath, "index.html"),
        );
    } else if (node.type === "asset" || node.type === "handoff.file") {
        await fs.mkdir(
            path.dirname(path.join(outputDirectory, node.outputPath)),
            { recursive: true },
        );
        await fs.copyFile(
            path.join(node.stagingDirectory, "finalized"),
            path.join(outputDirectory, node.outputPath),
        );
    } else if (node.type === "handoff") {
        await fs.mkdir(
            path.dirname(path.join(outputDirectory, node.outputPath)),
            { recursive: true },
        );
        await fs.cp(
            path.join(node.stagingDirectory, "finalized"),
            path.join(outputDirectory, node.outputPath),
            { recursive: true },
        );
    }

    await Promise.all(
        node.baseChildren
            .concat(node.derivedChildren)
            .map((child) => outputNode(child, outputDirectory)),
    );

    return node;
}
