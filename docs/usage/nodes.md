# Context Tree Nodes

A context tree node holds the following information:

- The path of the node (relative to the source directory), which is either a directory or a file, depending on the node's type.
- A type, one of `page`, `page.file`, `asset`, `handoff`, `handoff.file`. The `.file` suffix represents a node being from a file, which affects how the tree is built and processed.
- A local context, which only affects this node.
- An inheritable context, which child nodes can inherit properties from.
- A list of child nodes

## Context

A node's context holds all the information needed to process that node into a usable web page/asset. A few notable properties are listed here:

- `pathPrefixes`: Used to resolve paths at various points in the processing of building the site (see [path resolution](./path-resolution.md)).
- `pageMode` and `pagePattern`: Used to change how Tartan traverses the file tree (see the [discovery phase](./phases/discovery.md)).
- `pageSource`: Used to specify the file to load for processing (see the [processing phase](./phases/processing.md)).
