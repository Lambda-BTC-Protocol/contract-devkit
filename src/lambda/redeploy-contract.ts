import { DEPLOY_PREFIX } from "@/contracts/utils/DEPLOY_PREFIX";
import { ExecutionError } from "@/contracts/types/execution-error";
import { Metadata } from "@/contracts/types/metadata";
import { persistenceStorage } from "@/persistenceStorage";
import { loadAndInitContractFromFile } from "@/lambda/load-and-init-contract-from-file";

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
  const inStorage =
    persistenceStorage[fullDeployedContractPath(newContractName)];
  if (inStorage) {
    throw new ExecutionError(
      `redeploy: this contract name ${newContractName} is already taken!`,
    );
  }
  fullDeployedContractPathMap.set(
    fullDeployedContractPath(newContractName),
    templateContract,
  );
  persistenceStorage[fullDeployedContractPath(newContractName)] =
    await loadAndInitContractFromFile(templateContract).then((r) => r!);
}
