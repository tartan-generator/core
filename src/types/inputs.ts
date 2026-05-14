import { URL } from "url";

export type InputType = "module" | "json" | "raw" | "default";

export class TartanInput<T> {
    public value: T;
    public url: URL;
    public hash: string;
    public type: InputType;

    constructor(value: T, url: URL, hash: string, type: InputType) {
        this.value = value;
        this.url = url;
        this.hash = hash;
        this.type = type;
    }

    public toJSON() {
        return {
            url: this.url.href,
            hash: this.hash,
            type: this.type,
        };
    }
}
