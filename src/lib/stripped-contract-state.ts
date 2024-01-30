import { Contract } from "@/contracts/types/contract";

export function createStrippedState(
  contract: Contract,
): Record<string, unknown> {
  return Object.entries(contract).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      value = value.filter((v) => typeof v !== "function");
    }

    if (
      key === "activeOn" ||
      key === "mutations" ||
      key === "queries" ||
      typeof value === "function" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return acc;
    }
    return { ...acc, [key]: value };
  }, {});
}
