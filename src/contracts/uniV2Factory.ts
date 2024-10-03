import { z } from "zod";
import { Contract, ContractParams } from "./types/contract";
import { argsParsing } from "./utils/args-parsing";
import { ExecutionError } from "./types/execution-error";
import { ExtendedMap } from "./utils/extended-map";
import { zUtils } from "./utils/zod";
import { Ecosystem } from "./types/ecosystem";
import { Metadata } from "./types/metadata";
import UniV2Pair from "./uniV2Pair";
import { EventTypes } from "./aave/libraries/types/dataTypes";
import { loadContract } from "@/lib/utils";

export default class UniV2Factory implements Contract {
  activeOn = 100;
  feeTo: string;
  feeToSetter: string;
  defaultMintFee: bigint;
  defaultSwapFee: bigint;
  getPair: ExtendedMap<string, ExtendedMap<string, string>>;
  allPairs: string[];

  constructor() {
    this.feeTo = "";
    this.feeToSetter = "";
    this.defaultMintFee = 5n;
    this.defaultSwapFee = 5n;
    this.getPair = new ExtendedMap();
    this.allPairs = [];
    //TODO: remove created pairs
    this.initHardcodePairs("uniV2Factory-LP-bitcoin/proto", "bitcoin", "proto");
    this.initHardcodePairs("uniV2Factory-LP-bitcoin/pusd", "bitcoin", "pusd");
    this.initHardcodePairs("uniV2Factory-LP-proto/pusd", "proto", "pusd");
  }

  initHardcodePairs(pair: string, token0: string, token1: string) {
    if (!this.getPair.has(token0)) {
      this.getPair.set(token0, new ExtendedMap<string, string>());
    }
    if (!this.getPair.has(token1)) {
      this.getPair.set(token1, new ExtendedMap<string, string>());
    }

    this.getPair.get(token0)!.set(token1, pair);
    this.getPair.get(token1)!.set(token0, pair);

    this.allPairs.push(pair);
  }

  async initialize({ metadata, args, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint(), zUtils.bigint()]);
    const [feeToSetter, defaultMintFee, defaultSwapFee] = argsParsing(
      schema,
      args,
      "init"
    );

    this.feeToSetter = feeToSetter;
    this.defaultMintFee = defaultMintFee;
    this.defaultSwapFee = defaultSwapFee;

    eventLogger.log({
      type: EventTypes.INITIALIZED,
      message: `Initialized Factory with feeToSetter: ${this.feeToSetter}, defaultMintFee: ${this.defaultMintFee}, defaultSwapFee: ${this.defaultSwapFee}`,
    });
  }

  async allPairsLength(): Promise<number> {
    return this.allPairs.length;
  }

  async createPair({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<string> {
    const schema = z.tuple([z.string(), z.string()]);
    const [tokenA, tokenB] = argsParsing(schema, args, "createPair");

    if (tokenA === tokenB) {
      throw new ExecutionError("UniswapV2: IDENTICAL_ADDRESSES");
    }

    const [token0, token1] =
      tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];

    if (token0 === "") {
      throw new ExecutionError("UniswapV2: ZERO_ADDRESS");
    }

    if (this.getPair.get(token0)?.get(token1)) {
      throw new ExecutionError("UniswapV2: PAIR_EXISTS");
    }

    // Simulating contract creation via a factory
    const pair = await this.deployPairContract(
      token0,
      token1,
      ecosystem,
      metadata
    );

    if (!this.getPair.has(token0)) {
      this.getPair.set(token0, new ExtendedMap<string, string>());
    }
    if (!this.getPair.has(token1)) {
      this.getPair.set(token1, new ExtendedMap<string, string>());
    }

    this.getPair.get(token0)!.set(token1, pair);
    this.getPair.get(token1)!.set(token0, pair);

    this.allPairs.push(pair);

    eventLogger.log({
      type: "PairCreated",
      message: `Pair created: ${token0}-${token1}, Address: ${pair}`,
    });

    return pair;
  }

  async getSwapFee({ args }: ContractParams): Promise<bigint> {
    const schema = z.tuple([z.string()]);
    const [pair] = argsParsing(schema, args, "getSwapFee");

    if (!this.getPair.has(pair)) {
      throw new ExecutionError("UniswapV2: PAIR_NOT_EXISTS");
    }

    const fee = this.getPair.get(pair)!.get(pair);

    if (!fee) {
      return this.defaultSwapFee; // Return default if no specific fee is set
    }

    return BigInt(fee);
  }

  protected async deployPairContract(
    token0: string,
    token1: string,
    ecosystem: Ecosystem,
    metadata: Metadata
  ): Promise<string> {
    // This is where you'd simulate contract deployment
    const pairAddress = `${metadata.currentContract}-LP-${token0}/${token1}`;
    await ecosystem.redeployContract("uniV2Pair", pairAddress);

    const pairContract = await loadContract<UniV2Pair>(
      ecosystem,
      `dep:${pairAddress}`
    );

    await pairContract.initialize([token0, token1]);
    return pairAddress;
  }

  async getPairAddress({ args }: ContractParams): Promise<string | undefined> {
    const schema = z.tuple([z.string(), z.string()]);
    const [token0, token1] = argsParsing(schema, args, "getPairAddress");
    const pairAddress = this.getPair.get(token0)?.get(token1);
    if (pairAddress) {
      return `dep:${pairAddress}`;
    }
  }

  async setFeeTo({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([z.string()]);
    const [newFeeTo] = argsParsing(schema, args, "setFeeTo");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    this.feeTo = newFeeTo;
  }

  async setFeeToSetter({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([z.string()]);
    const [newFeeToSetter] = argsParsing(schema, args, "setFeeToSetter");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    this.feeToSetter = newFeeToSetter;
  }

  async setMintFee({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [pair, mintFee] = argsParsing(schema, args, "setMintFee");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    if (!this.getPair.has(pair)) {
      throw new ExecutionError("UniswapV2: PAIR_NOT_EXISTS");
    }

    this.getPair.get(pair)!.set(pair, mintFee.toString());
  }

  async getPairs({ metadata, args }: ContractParams) {
    return Array.from(this.getPair);
  }

  async setSwapFee({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [pair, swapFee] = argsParsing(schema, args, "setSwapFee");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    if (!this.getPair.has(pair)) {
      throw new ExecutionError("UniswapV2: PAIR_NOT_EXISTS");
    }

    this.getPair.get(pair)!.set(pair, swapFee.toString());
  }

  async setDefaultMintFee({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([zUtils.bigint()]);
    const [defaultMintFee] = argsParsing(schema, args, "setDefaultMintFee");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    this.defaultMintFee = defaultMintFee;
  }

  async setDefaultSwapFee({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([zUtils.bigint()]);
    const [defaultSwapFee] = argsParsing(schema, args, "setDefaultSwapFee");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    this.defaultSwapFee = defaultSwapFee;
  }
}
