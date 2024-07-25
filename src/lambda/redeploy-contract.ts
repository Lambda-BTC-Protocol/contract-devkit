import { DEPLOY_PREFIX } from "@/contracts/utils/DEPLOY_PREFIX";
import { ExecutionError } from "@/contracts/types/execution-error";
import { Metadata } from "@/contracts/types/metadata";
import { deployedContractsStorage } from "@/lambda/global";

const fullDeployedContractPathMap = new Map<string, string>();

const fullDeployedContractPath = (name: string) => {
  return `${DEPLOY_PREFIX}${name}`;
};

export async function redeployContract(
  templateContract: string,
  newContractName: string,
  metadata: Metadata,
) {
  if (newContractName.length === 0)
    throw new ExecutionError("deploy: name cant be empty");
  if (newContractName.includes("."))
    throw new ExecutionError("deploy: '.' is not allowed in contract name");
  const inStorage = await deployedContractsStorage.get(
    fullDeployedContractPath(newContractName),
  );
  if (inStorage) {
    throw new ExecutionError(
      `redeploy: this contract name ${newContractName} is already taken!`,
    );
  }
  fullDeployedContractPathMap.set(
    fullDeployedContractPath(newContractName),
    templateContract,
  );
  await deployedContractsStorage.set(
    fullDeployedContractPath(newContractName),
    templateContract,
    0,
  );
}

export async function loadDeployedContractName(
  deployedContractName: string,
): Promise<string | null> {
  if (fullDeployedContractPathMap.has(deployedContractName)) {
    return fullDeployedContractPathMap.get(deployedContractName)!;
  }
  const inStorage = await deployedContractsStorage.get(deployedContractName);
  if (!inStorage) return null;
  fullDeployedContractPathMap.set(deployedContractName, inStorage);
  return inStorage;
}

export async function removeFromMapAndStorage(deployedContractName: string) {
  fullDeployedContractPathMap.delete(deployedContractName);
  await deployedContractsStorage.delete(deployedContractName);
}
