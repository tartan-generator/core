# Node Resolving

This phase is really simple. For each node in the tree follow these steps:

1. If this is the root node, simply set this node's output path to `.`. The `outputPath` from source processors is ignored.
2. If an `outputPath` was defined, resolve it relative to the parent node's output path. If the parent node was an asset, resolve relative to the same place the parent asset used. If the resolved path is above the parent path, throw an error.
3. If there are any children, repeat steps 1-4 on each one.
4. Combine the resolved children and output path with the original `ProcessedNode` and return it.
