import { Metadata } from "@/contracts/types/metadata";
import { Ecosystem } from "@/contracts/types/ecosystem";
import { Contract } from "@/contracts/types/contract";
import {
  contractWrapper,
  WrappedContract,
} from "@/contracts/utils/contract-wrapper";
import { redeployContract } from "@/lambda/redeploy-contract";
import { DEPLOY_PREFIX } from "@/contracts/utils/DEPLOY_PREFIX";
import { ExecutionError } from "@/contracts/types/execution-error";
import { persistenceStorage } from "@/persistenceStorage";
import { EventLogger } from "@/contracts/types/event-logger";

export function createEcosystem(
  callerContractName: string,
  metadata: Metadata,
): Ecosystem {
  return {
    getContractObj: async <T extends Contract>(
      toExecuteContractName: string,
    ): Promise<WrappedContract<T> | null> => {
      return await createWrappedContractObject(
        toExecuteContractName,
        metadata,
        callerContractName,
      );
    },
    redeployContract: async <T extends Contract>(
      templateContract: string,
      newContractName: string,
    ): Promise<WrappedContract<T>> => {
      await redeployContract(templateContract, newContractName, metadata);
      const eventLogger: EventLogger = { log: () => {} };
      eventLogger.log({
        type: "DEPLOY",
        message: `contract '${DEPLOY_PREFIX}${newContractName}' has been deployed!`,
      });
      const object = await createWrappedContractObject<T>(
        DEPLOY_PREFIX + newContractName,
        metadata,
        callerContractName,
      );
      if (!object) throw new ExecutionError("deploy: Contract not found");
      return object;
    },
  } satisfies Ecosystem;
}

async function createWrappedContractObject<T extends Contract>(
  toExecuteContractName: string,
  metadata: Metadata,
  callerContractName: string,
): Promise<WrappedContract<T> | null> {
  // check if contract is already loaded in memory, otherwise load it from file. contracts acts as a buffer for uncommitted changes
  const contractObj = persistenceStorage[toExecuteContractName] as T | null;
  if (contractObj === null) return null;

  // make sure only active contracts are executed; Deployed contracts are always active
  if (
    contractObj.activeOn > metadata.blockNumber &&
    !toExecuteContractName.startsWith(DEPLOY_PREFIX)
  )
    throw new ExecutionError("This contract is not active yet!");

  return contractWrapper<T>(contractObj, {
    metadata: {
      ...metadata,
      currentContract: toExecuteContractName,
      sender: callerContractName,
    },
    ecosystem: createEcosystem(toExecuteContractName, metadata),
    eventLogger: { log: () => {} },
  });
}
