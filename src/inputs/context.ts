import { TartanInput } from "../types/inputs.js";
import {
    FullTartanContext,
    PartialTartanContext,
    TartanContextFile,
} from "../types/tartan-context.js";
import path from "node:path";
import { PrefixMap, resolvePath } from "./resolve.js";
import { SourceProcessor } from "../types/source-processor.js";
import { loadModule } from "./module.js";
import { HandoffHandler } from "../types/handoff-handler.js";

export async function initializeContext(
    rootDir: string,
    contextFile: TartanInput<TartanContextFile>,
): Promise<TartanInput<PartialTartanContext>> {
    const resolvedPathPrefixes = Object.fromEntries(
        Object.entries(contextFile.value.pathPrefixes ?? {}).map(
            ([key, val]) => [
                key,
                resolvePath(val, path.dirname(contextFile.url.pathname), {
                    "~root": rootDir,
                    "~page-source": undefined,
                }),
            ],
        ),
    );

    const prefixMap: PrefixMap = {
        ...resolvedPathPrefixes,
        "~root": rootDir,
        "~page-source": undefined,
    };

    const sourceProcessors: FullTartanContext["sourceProcessors"] = contextFile
        .value.sourceProcessors
        ? await Promise.all(
              contextFile.value.sourceProcessors.map((processorPath) =>
                  loadModule<SourceProcessor>(
                      resolvePath(
                          processorPath,
                          path.dirname(contextFile.url.pathname),
                          prefixMap,
                      ),
                  ),
              ),
          )
        : undefined;

    const handoffHandler: FullTartanContext["handoffHandler"] = contextFile
        .value.handoffHandler
        ? await loadModule<HandoffHandler>(
              resolvePath(
                  contextFile.value.handoffHandler,
                  path.dirname(contextFile.url.pathname),
                  prefixMap,
              ),
          )
        : undefined;
    const assetProcessors: FullTartanContext["assetProcessors"] = contextFile
        .value.assetProcessors
        ? Object.fromEntries(
              await Promise.all(
                  Object.entries(contextFile.value.assetProcessors).map(
                      // for each glob
                      ([key, val]) =>
                          Promise.all(
                              val.map((url) =>
                                  loadModule<SourceProcessor>(
                                      resolvePath(
                                          url,
                                          path.dirname(
                                              contextFile.url.pathname,
                                          ),
                                          prefixMap,
                                      ),
                                  ),
                              ),
                          ).then((module) => [key, module]),
                  ),
              ),
          )
        : undefined;

    return {
        value: {
            ...contextFile.value,
            ...(sourceProcessors ? { sourceProcessors } : {}),
            ...(handoffHandler ? { handoffHandler } : {}),
            ...(assetProcessors ? { assetProcessors } : {}),
        } as PartialTartanContext,
        url: contextFile.url,
    };
}
