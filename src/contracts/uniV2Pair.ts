import { z } from "zod";
import { Contract, ContractParams } from "./types/contract";
import { zUtils } from "./utils/zod";
import { argsParsing } from "./utils/args-parsing";
import { EventLogger } from "./types/event-logger";
import { ExtendedMap } from "./utils/extended-map";
import { ExecutionError } from "./types/execution-error";
import { LRC20Base } from "./standards/base/LRC20Base";
import UniV2FactoryContract from "./uniV2Factory";
import { BigNumber } from 'typescript-bignumber'

export default class UniV2Pair implements Contract {
  activeOn: 100;
  _totalSupply = 0n;
  _allowance = new Map<string, Map<string, bigint>>();
  _balance = new ExtendedMap<string, bigint>();

  private provider?: any;
  private _factory: string;
  private _token0: string;
  private _token1: string;
  private _reserve0: bigint;
  private _reserve1: bigint;
  private _blockTimestampLast: number;

  public price0CumulativeLast: bigint;
  public price1CumulativeLast: bigint;
  public minimumLiquidity: bigint;
  public kLast: bigint;

  private unlocked: number = 1;

  constructor() {
    this.activeOn = 100;
    this._factory = "";
    this._token0 = "";
    this._token1 = "";
    this._reserve0 = 0n;
    this._reserve1 = 0n;
    this._blockTimestampLast = Date.now();
    this.price0CumulativeLast = 0n;
    this.price1CumulativeLast = 0n;
    this.kLast = 0n;
    this.minimumLiquidity = 10n;
  }

  async initialize({ metadata, args, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), z.string()]);
    const [token0, token1] = argsParsing(schema, args, "init");

    this._token0 = token0;
    this._token1 = token1;
    this._totalSupply = 0n;

    eventLogger.log({
      type: "INIT",
      message: `Initialized pair with token0: ${this._token0}, token1: ${this._token1}, and initial supply: ${this._totalSupply}`,
    });
  }

  async getToken0(): Promise<string> {
    return this._token0;
  }

  async getToken1(): Promise<string> {
    return this._token1;
  }

  async getReserves(): Promise<[bigint, bigint]> {
    return [this._reserve0, this._reserve1];
  }

  async transfer({
    metadata,
    args,
    eventLogger,
  }: ContractParams): Promise<boolean> {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [to, value] = argsParsing(schema, args, "transfer");
    this.transferLogic(metadata.sender, to, value, eventLogger);
    return true;
  }

  protected async transferLogic(
    from: string,
    to: string,
    value: bigint,
    eventLogger: EventLogger
  ) {
    const currentBalanceFrom = this._balance.get(from) ?? 0n;
    if (value > currentBalanceFrom)
      throw new ExecutionError("transfer: balance too small");

    this._balance.set(from, currentBalanceFrom - value);
    this._balance.update(
      to,
      0n,
      (currentBalanceTo) => currentBalanceTo + value
    );

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '${from}'; TO: '${to}'; VALUE: ${value}`,
    });
  }

  min(args: bigint[]) { return args.reduce((m, e) => e < m ? e : m) };


  sqrt(value: bigint) {
    if (value < 0n) {
      throw 'square root of negative numbers is not supported'
    }

    if (value < 2n) {
      return value;
    }

    function newtonIteration(n: any, x0: any) {
      const x1 = ((n / x0) + x0) >> 1n;
      if (x0 === x1 || x0 === (x1 - 1n)) {
        return x0;
      }
      return newtonIteration(n, x1);
    }

    return newtonIteration(value, 1n);
  }

  async mint({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<boolean> {
    const schema = z.tuple([z.string()]);
    const [to] = argsParsing(schema, args, "mint");

    // Get reserves
    const [_reserve0, _reserve1] = await this.getReserves();
    // Get token balances
    const token0Contract = await ecosystem.getContractObj<LRC20Base>(
      this._token0
    );

    const token1Contract = await ecosystem.getContractObj<LRC20Base>(
      this._token1
    );

    if (!token0Contract || !token1Contract) {
      throw new ExecutionError("Burn: cannot get token");
    }
    const balance0 = await token0Contract.balanceOf([metadata.currentContract]);
    const balance1 = await token1Contract.balanceOf([metadata.currentContract]);
    const amount0 = balance0 - _reserve0;
    const amount1 = balance1 - _reserve1;

    const feeOn = await this._mintFee(_reserve0, _reserve1);
    const _totalSupply = this._totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
    let liquidity;
    if (_totalSupply == 0n) {
      liquidity = this.sqrt(amount0 * amount1) - this.minimumLiquidity;
      await this._mint("wallet0", this.minimumLiquidity, eventLogger); // permanently lock the first MINIMUM_LIQUIDITY tokens
    } else {
      liquidity = this.min([
        (amount0 * _totalSupply) / _reserve0,
        (amount1 * _totalSupply) / _reserve1
      ]);
    }
    if (liquidity <= 0n) {
      throw new ExecutionError("UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED");
    }
    await this._mint(to, liquidity, eventLogger);

    await this._update(balance0, balance1, _reserve0, _reserve1);
    if (feeOn) this.kLast = _reserve0 * _reserve1; // reserve0 and reserve1 are up-to-date
    eventLogger.log({
      type: "MINT",
      message: `TO: '${to}'; VALUE1: ${amount0}, VALUE1: ${amount1}`,
    });
    return true;
  }

  protected async _mint(to: string, value: bigint, eventLogger: EventLogger) {
    this._totalSupply += value;
    const currentBalanceTo = this._balance.get(to) ?? 0n;
    this._balance.set(to, currentBalanceTo + value);

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '${this._factory}'; TO: '${to}'; VALUE: ${value}`,
    });
  }

  balanceOf({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "balanceOf");

    return this._balance.get(from) ?? 0n;
  }

  async burn({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<[bigint, bigint]> {
    const schema = z.tuple([z.string()]);
    const [to] = argsParsing(schema, args, "burn");

    // Get reserves
    const [_reserve0, _reserve1] = await this.getReserves();

    // Get token balances
    const token0Contract = await ecosystem.getContractObj<LRC20Base>(
      this._token0
    );
    const token1Contract = await ecosystem.getContractObj<LRC20Base>(
      this._token1
    );

    if (!token0Contract || !token1Contract) {
      throw new ExecutionError("Burn: cannot get token");
    }

    const balance0 = await token0Contract.balanceOf([metadata.origin]);
    const balance1 = await token1Contract.balanceOf([metadata.origin]);

    const liquidity = this._balance.get(metadata.origin) || 0n;

    // Calculate fee
    const feeOn = await this._mintFee(_reserve0, _reserve1);
    const _totalSupply = this._totalSupply;

    // Calculate amount0 and amount1
    const amount0 = (liquidity * balance0) / _totalSupply;
    const amount1 = (liquidity * balance1) / _totalSupply;

    if (amount0 <= 0n || amount1 <= 0n) {
      throw new ExecutionError("UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED");
    }

    // Burn the liquidity
    await this._burn(metadata.origin, liquidity, eventLogger);

    // Transfer tokens
    await this.transferLogic(this._token0, to, amount0, eventLogger);
    await this.transferLogic(this._token1, to, amount0, eventLogger);

    // Update balances
    const updatedBalance0 = await token0Contract.balanceOf([metadata.origin]);
    const updatedBalance1 = await token1Contract.balanceOf([metadata.origin]);

    await this.update({
      metadata,
      args: [updatedBalance0, updatedBalance1],
      ecosystem,
      eventLogger,
    });

    // Update kLast if fee is on
    if (feeOn) {
      this.kLast = _reserve0 * _reserve1;
    }

    eventLogger.log({
      type: "BURN",
      message: `FROM: '${metadata.sender}'; TO: '${to}'; AMOUNT0: ${amount0}; AMOUNT1: ${amount1}`,
    });

    return [amount0, amount1];
  }

  protected async _burn(from: string, value: bigint, eventLogger: EventLogger) {
    const currentBalanceFrom = this._balance.get(from) ?? 0n;
    if (value > currentBalanceFrom) {
      throw new ExecutionError("burn: balance too small");
    }

    this._balance.set(from, currentBalanceFrom - value);
    this._totalSupply -= value;

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '${from}'; TO: '${this._factory}'; VALUE: ${value}`,
    });
  }

  // Helper methods to implement:
  protected async _mintFee(
    _reserve0: bigint,
    _reserve1: bigint
  ): Promise<boolean> {
    return true;
    // Implement _mintFee logic based on your contract's requirements
  }

  async approve({
    metadata,
    args,
    eventLogger,
  }: ContractParams): Promise<boolean> {
    const schema = z.tuple([z.string(), z.string(), zUtils.bigint()]);
    const [owner, spender, value] = argsParsing(schema, args, "approve");
    await this._approve(owner, spender, value, eventLogger);
    return true;
  }

  protected async _approve(
    owner: string,
    spender: string,
    value: bigint,
    eventLogger: EventLogger
  ) {
    let ownerAllowances = this._allowance.get(owner);
    if (!ownerAllowances) {
      ownerAllowances = new Map<string, bigint>();
      this._allowance.set(owner, ownerAllowances);
    }
    ownerAllowances.set(spender, value);

    eventLogger.log({
      type: "APPROVAL",
      message: `OWNER: '${owner}'; SPENDER: '${spender}'; VALUE: ${value}`,
    });
  }

  private encode(value: bigint): bigint {
    return value << 112n;
  }

  private uqdiv(a: bigint, b: bigint): bigint {
    if (b === 0n) {
      throw new ExecutionError("Division by zero in uqdiv");
    }
    return a / b;
  }

  public async update({ metadata, args }: ContractParams): Promise<void> {
    const schema = z.tuple([zUtils.bigint(), zUtils.bigint()]);
    const [balance0, balance1] = argsParsing(schema, args, "update");

    if (balance0 > BigInt(2 ** 112 - 1) || balance1 > BigInt(2 ** 112 - 1)) {
      throw new ExecutionError("UniswapV2: OVERFLOW");
    }

    const blockTimestamp = Math.floor(metadata.timestamp / 1000) % 2 ** 32;
    const timeElapsed = blockTimestamp - this._blockTimestampLast;

    if (timeElapsed > 0 && this._reserve0 !== 0n && this._reserve1 !== 0n) {
      this.price0CumulativeLast +=
        this.uqdiv(this.encode(this._reserve1), this._reserve0) *
        BigInt(timeElapsed);
      this.price1CumulativeLast +=
        this.uqdiv(this.encode(this._reserve0), this._reserve1) *
        BigInt(timeElapsed);
    }

    this._reserve0 = balance0;
    this._reserve1 = balance1;
    this._blockTimestampLast = blockTimestamp;

    console.log(
      `Sync event: reserve0 = ${this._reserve0}, reserve1 = ${this._reserve1}`
    );
  }

  private async _update(
    balance0: bigint,
    balance1: bigint,
    _reserve0: bigint,
    _reserve1: bigint
  ): Promise<void> {
    const uint112Max = BigInt(2 ** 112 - 1);

    if (balance0 > uint112Max || balance1 > uint112Max) {
      throw new ExecutionError("UniswapV2: OVERFLOW");
    }

    const blockTimestamp = BigInt(Math.floor(Date.now() / 1000) % 2 ** 32);
    const timeElapsed = blockTimestamp - BigInt(this._blockTimestampLast);

    if (timeElapsed > 0 && _reserve0 !== 0n && _reserve1 !== 0n) {
      this.price0CumulativeLast +=
        this.uqdiv(this.encode(_reserve1), _reserve0) * timeElapsed;
      this.price1CumulativeLast +=
        this.uqdiv(this.encode(_reserve0), _reserve1) * timeElapsed;
    }

    this._reserve0 = balance0;
    this._reserve1 = balance1;
    this._blockTimestampLast = Number(blockTimestamp);

    console.log(
      `Sync event: reserve0 = ${this._reserve0}, reserve1 = ${this._reserve1}`
    );
  }

  async swap({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<void> {
    const schema = z.tuple([zUtils.bigint(), zUtils.bigint(), z.string()]);
    const [amount0Out, amount1Out, to] = argsParsing(schema, args, "swap");

    if (amount0Out <= 0n && amount1Out <= 0n) {
      throw new ExecutionError("UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT");
    }

    const [_reserve0, _reserve1] = await this.getReserves();

    if (amount0Out >= _reserve0 || amount1Out >= _reserve1) {
      throw new ExecutionError("UniswapV2: INSUFFICIENT_LIQUIDITY");
    }

    const token0 = this._token0;
    const token1 = this._token1;

    if (to === token0 || to === token1) {
      throw new ExecutionError("UniswapV2: INVALID_TO");
    }

    // Simulate transferring tokens
    if (amount0Out > 0n) {
      await this.transferLogic(token0, to, amount0Out, eventLogger);
    }
    if (amount1Out > 0n) {
      await this.transferLogic(token1, to, amount1Out, eventLogger);
    }
    // Get token balances
    const token0Contract = await ecosystem.getContractObj<LRC20Base>(
      this._token0
    );
    const token1Contract = await ecosystem.getContractObj<LRC20Base>(
      this._token1
    );
    const factoryContract =
      await ecosystem.getContractObj<UniV2FactoryContract>(this._factory);

    if (!token0Contract || !token1Contract || !factoryContract) {
      throw new ExecutionError("Swap: cannot get token");
    }
    if (!factoryContract) {
      throw new ExecutionError("Swap: cannot get factory");
    }

    const balance0 = await token0Contract.balanceOf([metadata.origin]);
    const balance1 = await token1Contract.balanceOf([metadata.origin]);

    const amount0In =
      balance0 > _reserve0 - amount0Out
        ? balance0 - (_reserve0 - amount0Out)
        : 0n;
    const amount1In =
      balance1 > _reserve1 - amount1Out
        ? balance1 - (_reserve1 - amount1Out)
        : 0n;

    if (amount0In <= 0n && amount1In <= 0n) {
      throw new ExecutionError("UniswapV2: INSUFFICIENT_INPUT_AMOUNT");
    }

    const swapFee = await factoryContract.getSwapFee([]);
    const balance0Adjusted = balance0 * 1000n - amount0In * swapFee;
    const balance1Adjusted = balance1 * 1000n - amount1In * swapFee;

    if (
      balance0Adjusted * balance1Adjusted <
      _reserve0 * _reserve1 * 1000n ** 2n
    ) {
      throw new ExecutionError("UniswapV2: K");
    }

    await this._update(balance0, balance1, _reserve0, _reserve1);

    eventLogger.log({
      type: "SWAP",
      message: `FROM: '${metadata.sender}'; AMOUNT0_IN: ${amount0In}; AMOUNT1_IN: ${amount1In}; AMOUNT0_OUT: ${amount0Out}; AMOUNT1_OUT: ${amount1Out}; TO: '${to}'`,
    });
  }
}
