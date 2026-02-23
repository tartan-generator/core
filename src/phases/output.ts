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
    const logger = node.logger.child({ phase: "output" });
    logger.info("copying finalized source to output directory");
    if (node.type === "page" || node.type === "page.file") {
        logger.debug("creating output directory for page");
        await fs.mkdir(path.join(path.join(outputDirectory, node.outputPath)), {
            recursive: true,
        });
        logger.debug("copying to index.html");
        await fs.copyFile(
            path.join(node.stagingDirectory, "finalized"),
            path.join(outputDirectory, node.outputPath, "index.html"),
        );
    } else if (node.type === "asset" || node.type === "handoff.file") {
        logger.debug("creating parent directory for file");
        await fs.mkdir(
            path.dirname(path.join(outputDirectory, node.outputPath)),
            { recursive: true },
        );
        logger.debug("copying file to output path");
        await fs.copyFile(
            path.join(node.stagingDirectory, "finalized"),
            path.join(outputDirectory, node.outputPath),
        );
    } else if (node.type === "handoff") {
        logger.debug("creating output directory for handoff node");
        await fs.mkdir(
            path.dirname(path.join(outputDirectory, node.outputPath)),
            { recursive: true },
        );
        logger.debug(
            "copying entire finalized directory tree to output directory",
        );
        await fs.cp(
            path.join(node.stagingDirectory, "finalized"),
            path.join(outputDirectory, node.outputPath),
            { recursive: true },
        );
    }

    logger.info("waiting for children to output");
    await Promise.all(
        node.baseChildren
            .concat(node.derivedChildren)
            .map((child) => outputNode(child, outputDirectory)),
    );

    logger.info("finished outputting");

    return node;
}
