/*
 * Utility types
 */

export type ReplaceTypes<
    /**
     * Type to replace properties on.
     */ T,
    /**
     * Record of keys to the replaced type
     */
    R extends Partial<Record<keyof T, any>>,
> = Omit<T, keyof R> & R;
export type RequireKeys<T, K extends keyof T> = Omit<T, K> &
    Required<Pick<T, K>>;
