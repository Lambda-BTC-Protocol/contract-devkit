import Bitcoin from "@/contracts/bitcoin";
import Proto from "@/contracts/proto";
import Pusd from "@/contracts/pusd";
import ReadAndStore from "@/contracts/readAndStore";
import { Contract } from "@/contracts/types/contract";
import Move from "@/contracts/move";

export const persistenceStorage: Record<string, Contract> = {
  bitcoin: new Bitcoin(),
  proto: new Proto(),
  pusd: new Pusd(),
  readAndStore: new ReadAndStore(),
  move: new Move(),
};
