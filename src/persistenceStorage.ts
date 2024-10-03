import Bitcoin from "@/contracts/bitcoin";
import Proto from "@/contracts/proto";
import Pusd from "@/contracts/pusd";
import { Contract } from "@/contracts/types/contract";
import Move from "@/contracts/move";
import LendingPool from "./contracts/lendingPool";
import Oracle from "./contracts/oracle";
import UniV2Pair from "./contracts/uniV2Pair";
import UniV2Factory from "./contracts/uniV2Factory";
import UniV2Router from "./contracts/uniV2Router";
import StableDebtToken from "./contracts/stableDebtToken";
import VariableDebtToken from "./contracts/variableDebtToken";
import aToken from "./contracts/aToken";
import DefaultReserveInterestRateStrategy from "./contracts/defaultReserveInterestRateStrategy";
import LendingPoolConfigurator from "./contracts/lendingPoolConfigurator";
import LendingRateOracle from "./contracts/lendingRateOracle";

export const persistenceStorage: Record<string, Contract> = {
  bitcoin: new Bitcoin(),
  proto: new Proto(),
  pusd: new Pusd(),
  move: new Move(),
  aToken: new aToken(),
  stableDebtToken: new StableDebtToken(),
  variableDebtToken: new VariableDebtToken(),
  lendingPool: new LendingPool(),
  lendingPoolConfigurator: new LendingPoolConfigurator(),
  lendingRateOracle: new LendingRateOracle(),
  oracle: new Oracle(),
  defaultReserveInterestRateStrategy: new DefaultReserveInterestRateStrategy(),
  uniV2Factory: new UniV2Factory(),
  uniV2Pair: new UniV2Pair(),
  uniV2Router: new UniV2Router(),
  "dep:uniV2Factory-LP-bitcoin/proto": new UniV2Pair(),
  "dep:uniV2Factory-LP-proto/pusd": new UniV2Pair(),
  "dep:uniV2Factory-LP-bitcoin/pusd": new UniV2Pair(),
};
