import { z } from "zod";
import UniV2Factory from "./uniV2Factory";
import { Contract, ContractParams } from "./types/contract";
import { zUtils } from "./utils/zod";
import { argsParsing } from "./utils/args-parsing";
import { Ecosystem } from "./types/ecosystem";
import { ExecutionError } from "./types/execution-error";
import { Metadata } from "./types/metadata";
import { LRC20Base } from "./standards/base/LRC20Base";
import UniV2Pair from "./uniV2Pair";
import { loadContract } from "@/lib/utils";
import { EventTypes } from "./aave/libraries/types/dataTypes";

export default class UniV2Router implements Contract {
  activeOn = 100;
  private _isInitialized = false;
  public factory: string = "";

  constructor() {}

  private _onlyInitialized() {
    if (!this._isInitialized) {
      throw new ExecutionError("Router is not initialized");
    }
  }

  init({ metadata, args, eventLogger, ecosystem }: ContractParams) {
    if (this._isInitialized) {
      throw new ExecutionError("UniswapV2Router: ALREADY_INITIALIZED");
    }

    const schema = z.tuple([z.string()]);
    const [factory] = argsParsing(schema, args, "init");
    this.factory = factory;
    this._isInitialized = true;

    eventLogger.log({
      type: EventTypes.INITIALIZED,
      message: `UniswapV2Router initialized with factory: ${factory}`,
    });
  }

  ensure(deadline: bigint): void {
    if (BigInt(Date.now()) >= deadline) {
      throw new ExecutionError("UniswapV2Router: EXPIRED");
    }
  }

  async quote({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<bigint> {
    this._onlyInitialized();

    const schema = z.tuple([zUtils.bigint(), zUtils.bigint(), zUtils.bigint()]);
    const [amountA, reserveA, reserveB] = argsParsing(schema, args, "quote");

    if (amountA <= 0n) throw new ExecutionError("Quote: INSUFFICIENT_AMOUNT");
    if (reserveA <= 0n || reserveB <= 0n)
      throw new ExecutionError("Quote: INSUFFICIENT_LIQUIDITY");

    // Calculate the price based on the Uniswap constant product formula
    return (amountA * reserveB) / reserveA;
  }

  protected async _addLiquidity({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<[bigint, bigint]> {
    this._onlyInitialized();

    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);
    const [
      tokenA,
      tokenB,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
    ] = argsParsing(schema, args, "quote");

    const factoryContract = await loadContract<UniV2Factory>(
      ecosystem,
      this.factory
    );

    let pair = await factoryContract.getPairAddress([tokenA, tokenB]);

    if (!pair) {
      await factoryContract.createPair([tokenA, tokenB]);
      pair = await factoryContract.getPairAddress([tokenA, tokenB]);
    } else {
      //TODO: remove else block
      const pairContract = await loadContract<UniV2Pair>(ecosystem, `${pair}`);

      await pairContract.initialize([tokenA, tokenB]);
    }

    if (!pair)
      throw new ExecutionError("UniswapV2Router: Cannot get pair contract");

    const pairContract = await loadContract<UniV2Pair>(ecosystem, pair);

    const [reserveA, reserveB] = await pairContract.getReserves([]);
    let amountA: bigint;
    let amountB: bigint;

    if (reserveA === 0n && reserveB === 0n) {
      amountA = amountADesired;
      amountB = amountBDesired;
    } else {
      const amountBOptimal = await this.quote({
        args: [amountADesired, reserveA, reserveB],
        ecosystem,
        eventLogger,
        metadata,
      });
      if (amountBOptimal <= amountBDesired) {
        if (amountBOptimal < amountBMin)
          throw new ExecutionError("UniswapV2Router: INSUFFICIENT_B_AMOUNT");
        amountA = amountADesired;
        amountB = amountBOptimal;
      } else {
        const amountAOptimal = await this.quote({
          args: [amountBDesired, reserveB, reserveA],
          ecosystem,
          eventLogger,
          metadata,
        });
        if (amountAOptimal < amountAMin)
          throw new ExecutionError("UniswapV2Router: INSUFFICIENT_A_AMOUNT");
        amountA = amountAOptimal;
        amountB = amountBDesired;
      }
    }

    return [amountA, amountB];
  }

  async ensureDeadline(deadline: number, metadata: Metadata) {
    const blockTimestamp = Math.floor(metadata.timestamp / 1000) % 2 ** 32;

    if (deadline < blockTimestamp) {
      throw new ExecutionError("UniswapV2Router: EXPIRED");
    }
  }

  public async addLiquidity({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<[bigint, bigint, boolean]> {
    this._onlyInitialized();

    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      z.string(),
      z.number(),
    ]);
    const [
      tokenA,
      tokenB,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      to,
      deadline,
    ] = argsParsing(schema, args, "addLiquidity");
    this.ensureDeadline(deadline, metadata);
    const [token0, token1] =
      tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
    const [amountA, amountB] = await this._addLiquidity({
      args: [
        token0,
        token1,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
      ],
      ecosystem,
      eventLogger,
      metadata,
    });
    const factoryContract = await loadContract<UniV2Factory>(
      ecosystem,
      this.factory
    );

    const pairAddress = await factoryContract.getPairAddress([token0, token1]);
    if (!pairAddress) {
      throw new ExecutionError("Pair contract not found");
    }
    const Token0 = await loadContract<LRC20Base>(ecosystem, token0);
    const Token1 = await loadContract<LRC20Base>(ecosystem, token1);
    Token0.transferFrom([metadata.sender, pairAddress, amountA]);
    Token1.transferFrom([metadata.sender, pairAddress, amountB]);
    eventLogger.log({
      type: "PAIR_GOT",
      message: `pair: '${pairAddress}'`,
    });
    const pairContract = await loadContract<UniV2Pair>(ecosystem, pairAddress);
    let liquidity = false;
    if (pairContract) {
      liquidity = await pairContract.mint([to]);
    }

    return [amountA, amountB, liquidity];
  }
}
