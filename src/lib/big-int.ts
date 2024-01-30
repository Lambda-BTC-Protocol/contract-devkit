import JSONbig from "json-bigint";

export const bigIntJson = JSONbig({
  useNativeBigInt: true,
  storeAsString: true,
});
