Pretty bad performance. It's really wildly inefficient now that I think about it.

Caching `readdir` reduced discovery time by about 69% (noice) which is huge.

I want to find out where else time is being wasted.

Unfortunately there's not much I can do about the massive amount of IO wait time if each page of the shallow version has it's own context, but that's also fairly unlikely.
Also, if I have a file tree in memory it might be fairly easy to map it directly to the context tree, and therefore easy to cache for rebuilds. But first let's just take care of the `readdir` issue.
