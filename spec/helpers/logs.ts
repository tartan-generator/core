import { createLogger } from "winston";
import { NullTransport } from "../../src/index";

export const nullLogger = createLogger({
    transports: [new NullTransport()],
});
