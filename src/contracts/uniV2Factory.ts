import { z } from "zod";
import { Contract, ContractParams } from "./types/contract";
import { argsParsing } from "./utils/args-parsing";
import { ExecutionError } from "./types/execution-error";
import { ExtendedMap } from "./utils/extended-map";
import { zUtils } from "./utils/zod";
import { Ecosystem } from "./types/ecosystem";
import { Metadata } from "./types/metadata";
import UniV2Pair from "./uniV2Pair";

export default class UniV2Factory implements Contract {
  activeOn = 100;
  feeTo: string;
  feeToSetter: string;
  defaultMintFee: bigint;
  defaultSwapFee: bigint;
  getPair: ExtendedMap<string, ExtendedMap<string, string>>;
  allPairs: string[];

  constructor(
    feeToSetter: string,
    defaultMintFee: bigint,
    defaultSwapFee: bigint
  ) {
    this.feeTo = "";
    this.feeToSetter = feeToSetter;
    this.defaultMintFee = defaultMintFee;
    this.defaultSwapFee = defaultSwapFee;
    this.getPair = new ExtendedMap();
    this.allPairs = [];
    //TODO: remove created pairs
    this.initHardcodePairs("uniV2Factory-LP-bitcoin/proto", "bitcoin", "proto");
    this.initHardcodePairs("uniV2Factory-LP-bitcoin/pusd", "bitcoin", "pusd");
    this.initHardcodePairs("uniV2Factory-LP-proto/pusd", "proto", "pusd");
  }

  initHardcodePairs(pair:string, token0:string, token1:string){
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

    console.log(
      `Initialized Factory with feeToSetter: ${this.feeToSetter}, defaultMintFee: ${this.defaultMintFee}, defaultSwapFee: ${this.defaultSwapFee}`
    );
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
    const res = await ecosystem.redeployContract("uniV2Pair", pairAddress);
    console.log(
      `Deployed pair contract for ${token0} and ${token1} at address ${pairAddress}`
    );
    const pairContract = await ecosystem.getContractObj<UniV2Pair>(`dep:${pairAddress}`)
    if(!pairContract){
      throw new ExecutionError("UniswapV2Factory: Cannot get pair contract");
    }
    await pairContract.initialize([token0, token1])
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
    console.log(`FeeTo address set to: ${newFeeTo}`);
  }

  async setFeeToSetter({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([z.string()]);
    const [newFeeToSetter] = argsParsing(schema, args, "setFeeToSetter");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    this.feeToSetter = newFeeToSetter;
    console.log(`FeeToSetter address set to: ${newFeeToSetter}`);
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
    console.log(`Mint fee for pair ${pair} set to: ${mintFee}`);
  }

  async getPairs({ metadata, args }: ContractParams) {
    // const schema = z.tuple([z.string(), z.string()]);
    // const [tokenA, swapFee] = argsParsing(schema, args, "setSwapFee");

    // if (metadata.sender !== this.feeToSetter) {
    //   throw new ExecutionError("UniswapV2: FORBIDDEN");
    // }

    // if (!this.getPair.has(pair)) {
    //   throw new ExecutionError("UniswapV2: PAIR_NOT_EXISTS");
    // }

    // this.getPair.get(pair)!.set(pair, swapFee.toString());
    // console.log(`Swap fee for pair ${pair} set to: ${swapFee}`);
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
    console.log(`Swap fee for pair ${pair} set to: ${swapFee}`);
  }

  async setDefaultMintFee({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([zUtils.bigint()]);
    const [defaultMintFee] = argsParsing(schema, args, "setDefaultMintFee");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    this.defaultMintFee = defaultMintFee;
    console.log(`Default mint fee set to: ${defaultMintFee}`);
  }

  async setDefaultSwapFee({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([zUtils.bigint()]);
    const [defaultSwapFee] = argsParsing(schema, args, "setDefaultSwapFee");

    if (metadata.sender !== this.feeToSetter) {
      throw new ExecutionError("UniswapV2: FORBIDDEN");
    }

    this.defaultSwapFee = defaultSwapFee;
    console.log(`Default swap fee set to: ${defaultSwapFee}`);
  }
}
