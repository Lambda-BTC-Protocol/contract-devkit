import Bitcoin from "@/contracts/bitcoin";
import Proto from "@/contracts/proto";
import Pusd from "@/contracts/pusd";
import { Contract } from "@/contracts/types/contract";
import Move from "@/contracts/move";
import Pool from "./contracts/lendingPool";
import { aToken } from "./contracts/aToken";
import TokenManager from "./contracts/tokenManager";
import LendingPool from "./contracts/lendingPool";
import Oracle from "./contracts/oracle";
import PriceOracle from "./contracts/priceOracle";
import UniV2Pair from "./contracts/uniV2Pair";
import UniV2Factory from "./contracts/uniV2Factory";
import UniV2Router from "./contracts/uniV2Router";
export const persistenceStorage: Record<string, Contract> = {
  bitcoin: new Bitcoin(),
  proto: new Proto(),
  pusd: new Pusd(),
  move: new Move(),
  pool: new Pool(),
  aToken: new aToken(),
  tokenManager: new TokenManager(),
  lendingPool: new LendingPool(),
  oracle: new Oracle("uniV2Router", "uniV2Factory"),
  priceOracle: new PriceOracle(""),
  uniV2Factory: new UniV2Factory("", 5n, 5n),
  uniV2Pair: new UniV2Pair(),
  uniV2Router: new UniV2Router("uniV2Factory"),
  'dep:uniV2Factory-LP-bitcoin/proto': new UniV2Pair(),
  'dep:uniV2Factory-LP-proto/pusd': new UniV2Pair(),
  'dep:uniV2Factory-LP-bitcoin/pusd': new UniV2Pair()
};
