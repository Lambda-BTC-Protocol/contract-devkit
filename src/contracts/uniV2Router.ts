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

export default class UniV2Router implements Contract {
  activeOn = 100;
  public readonly factory: string;

  constructor(factory: string) {
    this.factory = factory;
  }

  ensure(deadline: bigint): void {
    if (BigInt(Date.now()) >= deadline) {
      throw new ExecutionError("UniswapV2Router: EXPIRED");
    }
  }

  async quote(
    amountA: bigint,
    reserveA: bigint,
    reserveB: bigint
  ): Promise<bigint> {
    if (amountA <= 0) throw new ExecutionError("Quote: INSUFFICIENT_AMOUNT");
    if (reserveA <= 0 || reserveB <= 0)
      throw new ExecutionError("Quote: INSUFFICIENT_LIQUIDITY");
    return (amountA * reserveB) / reserveA;
  }

  protected async _addLiquidity(
    tokenA: string,
    tokenB: string,
    amountADesired: bigint,
    amountBDesired: bigint,
    amountAMin: bigint,
    amountBMin: bigint,
    ecosystem: Ecosystem
  ): Promise<[bigint, bigint]> {
    // create the pair if it doesn't exist yet
    const factoryContract = await ecosystem.getContractObj<UniV2Factory>(
      this.factory
    );
    if (!factoryContract) {
      throw new ExecutionError("UniswapV2Router: Cannot get factory contract");
    }

    let pair = await factoryContract.getPairAddress([tokenA, tokenB]);
    if (!pair) {
      await factoryContract.createPair([tokenA, tokenB]);
      pair = await factoryContract.getPairAddress([tokenA, tokenB]);
    } else {
      //TODO: remove else block
      const pairContract = await ecosystem.getContractObj<UniV2Pair>(`${pair}`)
      if (!pairContract) {
        throw new ExecutionError("UniswapV2Factory: Cannot get pair contract");
      }
      await pairContract.initialize([tokenA, tokenB])
    }

    if (!pair)
      throw new ExecutionError("UniswapV2Router: Cannot get pair contract");

    const pairContract = await ecosystem.getContractObj<UniV2Pair>(pair);

    if (!pairContract)
      throw new ExecutionError("UniswapV2Router: Cannot get pair contract");
    const [reserveA, reserveB] = await pairContract.getReserves([]);
    let amountA: bigint;
    let amountB: bigint;

    if (reserveA === 0n && reserveB === 0n) {
      amountA = amountADesired;
      amountB = amountBDesired;
    } else {
      const amountBOptimal = await this.quote(
        amountADesired,
        reserveA,
        reserveB
      );
      if (amountBOptimal <= amountBDesired) {
        if (amountBOptimal < amountBMin)
          throw new ExecutionError("UniswapV2Router: INSUFFICIENT_B_AMOUNT");
        amountA = amountADesired;
        amountB = amountBOptimal;
      } else {
        const amountAOptimal = await this.quote(
          amountBDesired,
          reserveB,
          reserveA
        );
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
    const [amountA, amountB] = await this._addLiquidity(
      token0,
      token1,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      ecosystem
    );
    const factoryContract = await ecosystem.getContractObj<UniV2Factory>(
      this.factory
    );
    if (!factoryContract)
      throw new ExecutionError("Factory contract not found");
    const pairAddress = await factoryContract.getPairAddress([token0, token1]);
    if (!pairAddress) {
      throw new ExecutionError("Pair contract not found");
    }
    const Token0 = await ecosystem.getContractObj<LRC20Base>(token0);
    if (!Token0) throw new ExecutionError("Token0 contract not found");
    const Token1 = await ecosystem.getContractObj<LRC20Base>(token1);
    if (!Token1) throw new ExecutionError("Token contract not found");
    Token0.transferFrom([metadata.sender, pairAddress, amountA]);
    Token1.transferFrom([metadata.sender, pairAddress, amountB]);
    eventLogger.log({
      type: "PAIR_GOT",
      message: `pair: '${pairAddress}'`,
    });
    const pairContract = await ecosystem.getContractObj<UniV2Pair>(pairAddress);
    let liquidity = false;
    if (pairContract) {
      liquidity = await pairContract.mint([to]);
    }

    return [amountA, amountB, liquidity];
  }
}
