import { Logger } from "@/Logger";
import {
  DeployedContractsStorage,
  DeployedContractsStorageImpl,
} from "@/lambda/deployed-contracts-storage";

export const logger = new Logger();

export const deployedContractsStorage: DeployedContractsStorage =
  new DeployedContractsStorageImpl();
