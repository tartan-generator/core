import pino from "pino";

export const nullLogger = pino({
    name: "null",
    level: "silent",
});
