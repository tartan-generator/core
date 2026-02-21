# Tartan Usage Docs

These are intended to document the features of Tartan, _not_ the underlying source code. If you want to understand the internals of Tartan, read the [developer docs](/dev).

## Introduction

Tartan is built with the understanding that most websites can (for the most part) be represented as a [tree](<https://wikipedia.org/wiki/Tree_(abstract_data_type)>), where each node is a page or asset. Most of the information about a node is stored in a "Context" object, which is why the tree that represents a website is referred to as the "Context Tree". Context objects control how child nodes are discovered/loaded, which functions are called to process the node, and what extra information is given to those functions. More info can be found [here](./nodes.md).

## Processing

Generating a website with tartan is done in five phases, listed below:

Phase 1: [**Discovery**](./phases/discovery.md) (Loading the context tree)

Phase 2: [**Processing**](./phases/processing.md) (Executing source processors/handoff handlers)

Phase 3: [**Resolving**](./phases/resolving.md) (Determining final output paths)

Phase 4: [**Finalizing**](./phases/finalizing.md) (Executing source/handoff finalizers)

Phase 5: [**Output**](./phases/output.md) (Creating the final output directory tree from the generated files)
