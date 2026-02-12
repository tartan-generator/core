export enum LogLevel {
    Silent = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Verbose = 4,
}
export class Logger {
    public static defaultLogLevel = process.env["TARTAN_LOG_LEVEL"]
        ? parseInt(process.env["TARTAN_LOG_LEVEL"])
        : 0; // no logs by default
    public static logLevel = this.defaultLogLevel;
    public static log(object: any, verbosity: LogLevel = 3) {
        if (verbosity <= this.logLevel) {
            console.log(object);
        }
    }
}
