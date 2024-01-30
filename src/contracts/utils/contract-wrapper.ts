// Removes all non function properties and _ prefixed functions from a type, and converts the function params to args: Array<unknown>
export type WrappedContract<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? K
    : never]: T[K] extends (...args: any[]) => infer R
    ? (args: Array<unknown>) => R
    : never;
};
