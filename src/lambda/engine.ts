import { Metadata } from "@/contracts/types/metadata";
import { Inscription } from "@/inscription";
import { Contract, ContractParams } from "@/contracts/types/contract";
import { persistenceStorage } from "@/persistenceStorage";
import _ from "lodash";
import { ExecutionError } from "@/contracts/types/execution-error";
import { Event } from "@/contracts/types/event";
import { TransactionLog } from "@/log";
import { logger } from "@/lambda/global";
import { WrappedContract } from "@/contracts/utils/contract-wrapper";
import { createEcosystem } from "@/lambda/create-ecosystem";

export async function engine(inscription: Inscription, metadata: Metadata) {
  console.log("inscription", inscription);
  console.log("metadata", metadata);
  if (inscription.op === "call") {
    const { contract: contractName, args, function: func } = inscription;
    const beforeCheckpoints = new Map<string, Contract>();
    const contract = persistenceStorage[contractName];
    beforeCheckpoints.set(contractName, _.cloneDeep(contract));
    const events: Event[] = [];
    const realMetadata = { ...metadata, currentContract: contractName };
    const params = {
      args,
      metadata: realMetadata,
      ecosystem: createEcosystem(contractName, metadata),
      eventLogger: {
        log: (event: Omit<Event, "contract">) => {
          events.push({ ...event, contract: contractName });
        },
      },
    } satisfies ContractParams;
    try {
      // @ts-ignore
      await contract[func](params);
      console.log("success");
      const log = {
        ...metadata,
        eventLogs: events,
        inscription: JSON.stringify(inscription),
        status: "SUCCESS",
        method: inscription.function,
        stateByteDiff: 0,
        protocolFees: 0,
      } satisfies TransactionLog;

      logger.addLog(log);
      // console.log(persistenceStorage);
    } catch (e: any) {
      console.error(e);
      // reset state
      for (let [name, state] of beforeCheckpoints.entries()) {
        persistenceStorage[name] = state;
      }
      logger.addLog({
        ...metadata,
        eventLogs: [],
        status: "ERROR",
        errorMessage: e.message,
        inscription: JSON.stringify(inscription),
        protocolFees: 0,
        stateByteDiff: 0,
      });
    }
  }
}

const contractWrapper = <T extends Contract>(
  contract: T,
  params: Omit<ContractParams, "args">,
): WrappedContract<T> => {
  return new Proxy(contract, {
    get(target: T, p: string | symbol): any {
      // @ts-ignore
      const origMethod: unknown = target[p];
      if (typeof origMethod === "function") {
        return (args: unknown[]) => {
          return origMethod.apply(target, [
            {
              ...params,
              args,
            } satisfies ContractParams,
          ]);
        };
      }
      return null;
    },
  }) as WrappedContract<T>;
};
