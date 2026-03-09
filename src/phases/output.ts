import { OutputtedNode, ResolvedNode } from "../types/nodes.js";
import fs from "fs/promises";
import { Dirent } from "node:fs";
import path from "node:path";
import { inspect } from "node:util";

/**
 * Output all the finalized files of this node and it's children into the output directory.
 *
 * @argument node The node to output.
 * @argument outputDirectory The root output directory.
 */
export async function outputNode(
    rootNode: ResolvedNode,
    outputDir: string,
): Promise<OutputtedNode> {
    /*
     * Set up stuff for simpler tree construction
     */
    const rootOutput: OutputtedNode = {
        path: ".",
        type: "directory",
        children: [],
    };
    const createdDirs: {
        [key: string]: OutputtedNode;
    } = { ".": rootOutput };
    const outputFile = async (
        sourcePath: string,
        outputPath: string, // relative to output directory
    ): Promise<void> => {
        const paths: string[] = outputPath
            .split(path.sep)
            .map((_, i, arr) => path.join(...arr.slice(0, i + 1)));
        for (let i = 0; i < paths.length; i++) {
            const val = paths[i];
            if (!Object.hasOwn(createdDirs, val)) {
                let node: OutputtedNode =
                    i < paths.length - 1 // all but the last are directories
                        ? { path: val, type: "directory", children: [] }
                        : {
                              path: val,
                              type: "file",
                              children: [],
                              size: await fs
                                  .stat(sourcePath)
                                  .then((stat) => stat.size),
                          };
                createdDirs[path.dirname(val)].children.push(node);
                if (node.type === "directory") createdDirs[node.path] = node;
            }
        }

        const resolvedOutput = path.join(outputDir, outputPath);
        await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
        await fs.copyFile(sourcePath, resolvedOutput);
    };

    /*
     * Output the nodes
     */
    const queue: ResolvedNode[] = [rootNode];

    while (queue.length > 0) {
        const node: ResolvedNode = queue.pop() as ResolvedNode;
        queue.push(...node.children);
        const logger = node.logger.child({ phase: "output" });
        logger.info(`copying finalized source to ${outputDir}`);

        const sourcePath: string = path.join(
            node.stagingDirectory,
            "finalized",
        );
        if (node.type === "page" || node.type === "page.file") {
            const outputPath: string = path.join(node.outputPath, "index.html");
            logger.debug(`copying to ${outputPath}`);
            await outputFile(sourcePath, outputPath);
        } else if (node.type === "asset" || node.type === "handoff.file") {
            const outputPath: string = node.outputPath;
            logger.debug(`copying to ${outputPath}`);
            await outputFile(sourcePath, outputPath);
        } else if (node.type === "handoff") {
            const entries: Dirent<string>[] = await fs.readdir(sourcePath, {
                withFileTypes: true,
                recursive: true,
            });

            for (const entry of entries) {
                if (!entry.isFile()) continue;

                const filePath: string = path.join(
                    entry.parentPath,
                    entry.name,
                );
                const relativePath = path.relative(sourcePath, filePath);
                const outputPath: string = path.join(
                    node.outputPath,
                    relativePath,
                );
                logger.debug(
                    `outputting file ${relativePath} to ${outputPath}`,
                );
                await outputFile(filePath, outputPath);
            }
        }
    }

    return rootOutput;
}
