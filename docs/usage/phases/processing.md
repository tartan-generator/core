# Node Processing

The Context Tree is processed from the bottom up. This is done to avoid post-processing for simple and common use cases like index pages/tables of contents.

The steps for processing a node are as follows:

## 1. Process Child Nodes

Follow steps 1 and 2 for each child node, so that results can be passed into source processors for this node.

## 2. Run Source Processors or Handoff Handler

- If the node is a handoff node, follow the instructions in `2b`, otherwise follow `2a`.
- If the node is a page, use the processors defined in the `sourceProcessors` property of the local context object.
- If the node is an asset, use the processors defined by whichever glob in `assetProcessors` matches the node's path. Note that the order globs will be checked is _not_ guaranteed.

### 2a. Source Processor Execution

Source processor outputs feed into each other in the order they're listed. This means the following things about a source processor's input object:

- The `getSourceBuffer` and `getSourceStream` functions return the `processedContents` outputted by the previous source processor, converted into a buffer/stream if necessary.
- The `sourceMetadata` property is the result of all the outputted metadata objects' top-level properties being overlayed on each other. Later processors will overwrite properties from earlier ones, if duplicates exist. This means that if a processor outputs `{a: "value"}` and a later one outputs `{a: "new value", b: "value"}`, the processed node will have the metadata `{a: "new value", b: "value"}`.
- The `outputPath` property is also cumulative. If a source processor doesn't return a value (or returns undefined) for that property, it won't be overwritten. Otherwise it will be.
- The `dependencies` property is the combination of all previously requested dependencies, de-duplicated. The paths are resolved immediately after they're returned by a source processor, and can use the `~source-processor`, `~source-directory`, `~this-node`, and `~node-module` prefixes.

If the node is of type `page` the file contents provided to the first source processor are from the file at `pageSource`, resolved relative to the node path using the path prefixes defined by the local context object, plus the reserved `~source-directory` prefix. Otherwise, if the node is `page.file` or `asset`, the file at the node path is used.

Right now, we only run the `process` function provided by the source processor (since we're in the "processing" phase).

### 2b. Handoff Handler Execution

Handoff handlers are far simpler. Tartan will simply execute the `process` function provided, passing in a `HandoffHandlerInput` object and receiving a `HandoffHandlerOutput` object.

## 3. Construct a Processed Node

- Load the children specified by the cumulative `dependencies` property. Paths are resolved relative to the source file. Children will be loaded as assets and inherit context from this node.
- Use the `SourceProcessorOutput` or `HandoffHandlerOutput` object(s), along with the result of processing `dependencies`, to create a `ProcessedNode` object and return it.
