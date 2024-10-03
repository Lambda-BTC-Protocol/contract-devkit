import { Contract } from "@/contracts/types/contract";
import { Ecosystem } from "@/contracts/types/ecosystem";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const loadContract = async <T extends Contract>(
  ecosystem: Ecosystem,
  contractName: string
) => {
  const contract = await ecosystem.getContractObj<T>(contractName);
  if (!contract) {
    throw new Error(`Contract ${contractName} not found`);
  }
  return contract;
};
