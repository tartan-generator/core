Pretty bad performance. It's really wildly inefficient now that I think about it.

Caching `readdir` reduced discovery time by about 69% (noice) which is huge.
Caching parsed paths along with that reduced discovery time by a further 80%, also huge.
Minor improvements in using explicit equality checks rather than looking at a hashmap for extension matching in `file-object.ts` (18% improvement)
(I think that means I've reduced discovery time by a total of 93%)

I would _really_ like to get this to run sub-1s for 10k pages on my laptop.
