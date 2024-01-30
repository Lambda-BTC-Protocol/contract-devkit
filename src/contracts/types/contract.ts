import { Metadata } from "@/contracts/types/metadata";
import { EventLogger } from "@/contracts/types/event-logger";
import { Ecosystem } from "@/contracts/types/ecosystem";

export type ContractParams = {
  metadata: Metadata;
  ecosystem: Ecosystem;
  eventLogger: EventLogger;
  args: Array<unknown>;
};

export interface Contract {
  activeOn: number;
}
