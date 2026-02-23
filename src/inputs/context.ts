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
import { Logger } from "winston";

/**
 * Initialize a context by resolving path prefixes and loading source processors/handoff handlers.
 *
 * @argument initialPrefixMap A map to use to resolve the `pathPrefixes` object and to combine with the resolved prefix map when loading source processors/handoff handlers.
 * @argument contextFile The context file to initialize.
 */
export async function initializeContext(
    initialPrefixMap: PrefixMap,
    contextFile: TartanInput<TartanContextFile>,
    logger: Logger,
): Promise<TartanInput<PartialTartanContext>> {
    logger.debug("resolving path prefixes");
    const resolvedPathPrefixes: Record<string, string> | undefined = contextFile
        .value.pathPrefixes
        ? Object.fromEntries(
              Object.entries(contextFile.value.pathPrefixes).map(
                  ([key, val]) => [
                      key,
                      resolvePath(
                          val,
                          path.dirname(contextFile.url.pathname),
                          initialPrefixMap,
                      ).pathname,
                  ],
              ),
          )
        : undefined;

    logger.debug("resolving and importing source processors");
    const sourceProcessors: FullTartanContext["sourceProcessors"] = contextFile
        .value.sourceProcessors
        ? await Promise.all(
              contextFile.value.sourceProcessors.map((processorPath) =>
                  loadModule<SourceProcessor>(
                      resolvePath(
                          processorPath,
                          path.dirname(contextFile.url.pathname),
                          {
                              ...initialPrefixMap,
                              ...resolvedPathPrefixes,
                          },
                      ),
                      logger,
                  ),
              ),
          )
        : undefined;

    logger.debug("resolving and importing handoff handler");
    const handoffHandler: FullTartanContext["handoffHandler"] = contextFile
        .value.handoffHandler
        ? await loadModule<HandoffHandler>(
              resolvePath(
                  contextFile.value.handoffHandler,
                  path.dirname(contextFile.url.pathname),
                  {
                      ...initialPrefixMap,
                      ...resolvedPathPrefixes,
                  },
              ),
              logger,
          )
        : undefined;

    logger.debug("resolving and importing asset source processors");
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
                                          {
                                              ...initialPrefixMap,
                                              ...resolvedPathPrefixes,
                                          },
                                      ),
                                      logger,
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
            ...(resolvedPathPrefixes
                ? { pathPrefixes: resolvedPathPrefixes }
                : {}),
        } as PartialTartanContext,
        url: contextFile.url,
    };
}
