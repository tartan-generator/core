import { JSONSchema, FromSchema } from "json-schema-to-ts";
import { ReplaceTypes } from "./util.js";
import { SourceProcessor } from "./source-processor.js";
import { HandoffHandler } from "./handoff-handler.js";
import { TartanInput } from "./inputs.js";

export const tartanContextSchema = {
    type: "object",
    properties: {
        inherit: {
            type: "boolean",
            description:
                "Whether or not to inherit values from parent nodes and default context files.",
        },
        pageMode: {
            enum: ["directory", "file", "asset", "handoff"],
        },
        pagePattern: {
            type: "string",
            description:
                "A blob pattern to match files when `pageMode` is `file` or `asset`.",
        },
        extraContext: {
            type: "object",
            additionalProperties: true,
            description:
                "A JSON object that contains arbitrary information to be passed to source processors and templates.",
        },
        pageSource: {
            type: "string",
            description:
                "The file to use for the index of the current directory, *regardless of `pageMode`*.",
        },
        handoffHandler: {
            type: "string",
            description:
                "A module specifier for a module who's default export is a `HandoffHandler`",
        },
        sourceProcessors: {
            type: "array",
            items: {
                type: "string",
            },
            description:
                "A list of specifiers for modules that export a source processor as their default export. If you include URL query params, they will be passed to the source processor as an object at runtime (in the `extraParameters` property of the parameter objects).",
        },
        assetProcessors: {
            type: "object",
            description:
                "A map of globs that match filenames to a list of module specifiers that export a source processor as their default export. Query params work the same here as they do for source processors.",
            additionalProperties: {
                type: "array",
                items: { type: "string" },
            },
        },
        extraAssets: {
            type: "array",
            items: {
                type: "string",
            },
            description:
                "A list of glob patterns to search for in the current directory, and add any files that match as assets",
        },
        pathPrefixes: {
            type: "object",
            description:
                "A map of prefixes to path parts. The path parts will be resolved using only the reserved path prefixes, and treated as relative to the context file they're from.",
            additionalProperties: {
                type: "string",
            },
        },
    },
    additionalProperties: false,
} as const satisfies JSONSchema;

export type TartanContextFile = FromSchema<typeof tartanContextSchema>;
export type PartialTartanContext = ReplaceTypes<
    TartanContextFile,
    {
        sourceProcessors?: TartanInput<SourceProcessor>[];
        handoffHandler?: TartanInput<HandoffHandler>;
        assetProcessors?: {
            [key: string]: TartanInput<SourceProcessor>[];
        };
    }
>;
export type FullTartanContext =
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "file"; pageSource?: string; pagePattern: string }
      >
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "directory"; pageSource: string }
      >
    | ReplaceTypes<
          PartialTartanContext,
          { pageMode: "asset"; pagePattern: string }
      >
    | ReplaceTypes<
          PartialTartanContext,
          {
              pageMode: "handoff";
              handoffHandler: TartanInput<HandoffHandler>;
          }
      >
    | ReplaceTypes<
          PartialTartanContext,
          {
              pageMode: "handoff.file";
              handoffHandler: TartanInput<HandoffHandler>;
          }
      >;
