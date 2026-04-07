import { URL } from "url";

export type InputType = "module" | "json" | "raw" | "default";
export type TartanInput<T> = {
    value: T;
    /**
     * the location of the input, as a `file:` url
     */
    url: URL;
    /**
     * A hash of the input. This is not a specific kind of hash, although the hash should be consistent across input types so that hashes can be meaningfully compared.
     */
    hash: string;
    type: InputType;
};
