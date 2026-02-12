import { URL } from "url";

export type TartanInput<T> = {
    value: T;
    /**
     * the location of the input, as a `file:` url
     */
    url: URL;
};
