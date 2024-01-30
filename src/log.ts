import { Metadata } from "@/contracts/types/metadata";
import { Event } from "@/contracts/types/event";

export type TransactionLog = (Omit<Metadata, "sender" | "currentContract"> & {
  stateByteDiff: number;
  protocolFees: number;
  inscription?: string;
  eventLogs: Array<Event>;
  parentHash?: string;
  currentContract?: string;
  method?: string;
}) &
  (
    | {
        status: "ERROR";
        errorMessage: string;
      }
    | {
        status: "SUCCESS";
      }
  );
