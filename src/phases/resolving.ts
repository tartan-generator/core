import path from "node:path";
import { ProcessedNode, ResolvedNode } from "../types/nodes.js";

/**
 * Resolve paths of a ProcessedNode and it's children, then return the ResolvedNode.
 *
 * @argument node The node to resolve.
 * @argument parentDir The path to resolve relative to. If this is being called outside of recursion, it should probably be left to the default (`.`).
 * @argument isRoot Whether this node is the root node. Defaults to true
 */
export function resolveNode(
    node: ProcessedNode,
    parentDir: string = ".",
    isRoot: boolean = true,
): ResolvedNode {
    const outputPath: string =
        isRoot === true
            ? "."
            : node.outputPath !== undefined
              ? node.outputPath
              : node.type === "page.file"
                ? path.parse(node.path).name
                : path.basename(node.path);

    const resolvedPath: string = path.normalize(
        path.join(parentDir, outputPath),
    );

    if (path.relative(parentDir, resolvedPath).startsWith("..")) {
        throw "can't have output path above parent node";
    }

    return {
        ...node,
        outputPath: resolvedPath,
        baseChildren: node.baseChildren.map((child) =>
            resolveNode(child, resolvedPath, false),
        ),
        derivedChildren: node.derivedChildren.map((child) =>
            resolveNode(
                child,
                node.type === "asset" ? parentDir : resolvedPath,
                false,
            ),
        ),
    };
}
