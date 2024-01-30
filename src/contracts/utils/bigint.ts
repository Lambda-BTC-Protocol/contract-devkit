import _ from "lodash";

export function bigIntMax(...args: bigint[]) {
  return _.max(args) ?? 0n;
}

export function bigIntMin(...args: bigint[]) {
  return _.min(args) ?? 0n;
}
