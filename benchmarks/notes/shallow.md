Pretty bad performance. It's really wildly inefficient now that I think about it.

In general, it's 2 calls to `fs.readdir` for every page, just in the discovery phase. that's pretty wasteful when I could instead call `fs.readdir` once to scan the whole source directory recursively, and then keep it in memory. And that should take very little memory to actually do, as long as I use regular objects.

The question is how to restructure the program so that every stage can use that cached `readdir`. If I assign each build a uuid then I can cache the state of the source directory by uuid and simply pass around that uuid. Make a little static class that lets programs fetch by uuid/path, and the it's a fairly minimal refactor.

Unfortunately there's not much I can do about the massive amount of IO wait time if each page of the shallow version has it's own context, but that's also fairly unlikely.
Also, if I have a file tree in memory it might be fairly easy to map it directly to the context tree, and therefore easy to cache for rebuilds. But first let's just take care of the `readdir` issue.
