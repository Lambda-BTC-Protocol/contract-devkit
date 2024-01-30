import { Contract } from "@/contracts/types/contract";
import { WrappedContract } from "@/contracts/utils/contract-wrapper";

export type Ecosystem = {
  getContractObj: <T extends Contract>(
    contractName: string,
  ) => Promise<WrappedContract<T> | null>;
  redeployContract: <T extends Contract>(
    templateContract: string,
    newContractName: string,
  ) => Promise<WrappedContract<T>>;
};
