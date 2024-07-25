// Removes all non function properties and _ prefixed functions from a type, and converts the function params to args: Array<unknown>
import { Contract, ContractParams } from "@/contracts/types/contract";

export type WrappedContract<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? K
    : never]: T[K] extends (...args: any[]) => infer R
    ? (args: Array<unknown>) => R
    : never;
};

export const contractWrapper = <T extends Contract>(
  contract: T,
  params: Omit<ContractParams, "args">,
): WrappedContract<T> => {
  return new Proxy(contract, {
    get(target: T, p: string | symbol): any {
      // @ts-expect-error no index signature of type string found on contract
      const origMethod: unknown = target[p];
      if (typeof origMethod === "function") {
        if (origMethod.name.startsWith("_")) return null;
        return (args: unknown[]) => {
          return origMethod.apply(target, [
            {
              ...params,
              args,
            } satisfies ContractParams,
          ]);
        };
      }
      return null;
    },
  }) as WrappedContract<T>;
};
