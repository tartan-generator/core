import TransportStream from "winston-transport";

/**
 * The structure of logged objects for nodes.
 */
export type LogEntry = {
    level: string;
    nodePath: string;
    nodeId: string;
    phase: "discovery" | "processing" | "resolving" | "finalizing" | "output";
    message: string;
};

export class NullTransport extends TransportStream {
    constructor() {
        super();
    }

    log(info: any, callback: any) {
        setImmediate(() => {
            this.emit("logged", info);
        });

        callback();
    }
}
