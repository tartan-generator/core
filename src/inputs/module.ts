import { TartanInput } from "../types/inputs.js";
import esbuild from "esbuild";
import { runInThisContext, Script } from "node:vm";
import { URL } from "node:url";
import { createRequire } from "node:module";
import { Logger } from "winston";

// put require in the global scope, if it's not already there.
// this is just so that I can use imports in the loaded modules, and share the global scope
if (!globalThis.require) {
    globalThis.require = createRequire(import.meta.url);
}
/**
 * @argument moduleURL A fully resolved file url
 */
export async function loadModule<T>(
    moduleURL: URL,
    logger: Logger,
): Promise<TartanInput<T>> {
    const result = await esbuild.build({
        entryPoints: [moduleURL.pathname],
        platform: "node",
        format: "iife",
        globalName: "exports",
        bundle: true,
        packages: "external",
        write: false,
        metafile: true,
        logLevel: "silent",
    });

    if (result.warnings.length > 0) {
        const formattedWarnings = esbuild.formatMessagesSync(result.warnings, {
            kind: "warning",
            color: true,
        });
        // print logs
        logger.warn(
            [
                "==================================================\n",
                `Warnings while building ${moduleURL}\n\n`,
                formattedWarnings.join("\n"),
                "==================================================",
            ].join("\n"),
        );
    }
    if (result.outputFiles.length !== 1) {
        throw `wrong number of output files. should be 1, was ${result.outputFiles.length}`;
    }

    const code = `${result.outputFiles[0].text}\nexports.default`;

    /*
     * Run the code and extract the default export
     */
    const defaultExport = runInThisContext(code);
    return {
        url: moduleURL,
        value: defaultExport,
    };
}

/*
 * Quick rant (with profanity):
 * FUCK JS MODULES BRO 😭
 * This piece of code is so fucking goddamn hacky dear fucking lord.
 * I don't want to give imports access to the full global scope, but without *manually* listing *every fucking builtin* that's my only option.
 * Genuinely, fuck javascript. People complain about the language, but I think really a lot of it makes sense internally. The nodejs module system? nope fuck you.
 * Steaming pile of fucking garbage oh my fucking god.
 */
