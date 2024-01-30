import SuperJSON from "superjson";
import { ExtendedMap } from "@/contracts/utils/extended-map";

/**
 * Register custom types for SuperJSON. If you use any custom types with **functions** you need to register them here otherwise they won't
 * behave correctly. Probably this is not necessary for most use cases as inbuilt types are already supported.
 */
export const registerSuperJSON = () => {
  SuperJSON.registerCustom<ExtendedMap<any, any>, Array<[any, any]>>(
    {
      isApplicable: (v): v is ExtendedMap<any, any> => v instanceof ExtendedMap,
      serialize: (v) => {
        console.log("map", v);
        return Array.from(v.entries());
      },
      deserialize: (v) => new ExtendedMap(v),
    },
    "ExtendedMap",
  );
};
