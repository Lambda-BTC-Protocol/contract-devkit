import { Contract } from "@/contracts/types/contract";

export async function loadAndInitContractFromFile(
  contractName: string,
): Promise<Contract | null> {
  return await loadContractFromFile(contractName);
}

async function loadContractFromFile(
  contractName: string,
): Promise<Contract | null> {
  const clazz = require(`../contracts/${contractName}`).default;
  return new clazz();
}
