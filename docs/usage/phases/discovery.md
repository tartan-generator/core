# Loading the Context Tree

Every node of the tree is loaded in the same way (described below), and loading the tree as a whole is simply done by loading a directory node at the source of your directory tree.

## Loading a Context Tree Node

To load a context tree node, you need to have the following information:

- A `directory` and (optionally) a `filename` to load the node from.
- The `root directory`, for resolving various paths
- A `root context` for for nodes to inherit from if they aren't inheriting from a parent.
- A parent's `inheritable context` (optional).
- A node type (which may be changed to be `handoff` or `handoff.file`)

With that information, loading a node consists of the following steps:

1. Load context files for the node.
    - If the node is a directory, context object files should be at `{directory}/tartan.context` and `{directory}/tartan.context.default`.
    - If the node is a file, context object files should be at `{directory}/{filename}.context` and `{directory}/{filename}.context.default`.
    - If a context object file doesn't exist, it's contents are simply treated as an empty object.

2. Initialize contexts.
    - Paths in the path prefix map are resolved, and can use the `~this-node`, `~source-directory`, and `~node-module` prefixes.
    - Source and asset processor lists are resolved and imported relative to the context object file's directory, and can use the prefixes defined in the prefix map (plus `~this-node`, `~source-directory`, and `~node-module`).
    - Note that path prefixes are resolved at initialization, so if a parent node's context uses `~this-node`, it would be relative to that parent, _not_ whatever node inherited it.

3. Merge contexts.
    - Inheritable context is created by merging the `context.default` file contents with the parent node's `inheritable context` (if the `inherit` property of the context file is `true`), or the `root context` (if `inherit` is `false`).
    - Local context is created by merging the `context` file contents with _this_ node's `inheritable context` (if the `inherit` property of the context file is `true`), or the `root context` (if `inherit` is `false`).
    - Merging is done by overlaying the top level properties. A local context overrides properties from the inheritable context, and the inheritable context overrides properties from the parent's inheritable context, or the root context (if the `inherit` property is false).

4. Determine the node type (may have been changed to `handoff`).
    - If the node's local context specifies that the page mode is `handoff`, the original node type will be overridden.
    - If the node's original type was `page.file` or `asset`, the type will be set to `handoff.file`, otherwise it'll be set to `handoff`.

5. Try to load children.
    - If the node is of type `page.file`, `asset`, `handoff`, or `handoff.file`, it can have no children.
    - If the page mode (as defined by the node's local context) is `page`, all subdirectories are loaded as child nodes with the `page` type.
    - If the page mode is `file`, subdirectories and files that match the `pagePattern` are loaded as children (files with the `page.file` type, and directories with the `page` type). The file specified by the `pageSource` local context property and any possible context object files are ignored, even if they match `pagePattern`.
    - If the page mode is `asset`, child nodes are loaded in the same manner as the `file` page mode, except that files are given the `asset` type.
