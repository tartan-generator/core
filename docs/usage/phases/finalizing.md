# Finalizing Nodes

The finalize stage is almost exactly like the processing stage, with only a few differences:

- The first input to the list of processors is the output from the processing phase.
- Finalizers, instead of being given a list of the node's children, are given two `ResolvedNode`s (the root node, and the current node).
- Finalizers only output a buffer or a stream (the finalized file output), or in the case of handoff finalizers, nothing.
