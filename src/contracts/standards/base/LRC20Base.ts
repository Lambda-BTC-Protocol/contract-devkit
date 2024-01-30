import { ExecutionError } from "@/contracts/types/execution-error";
import { EventLogger } from "@/contracts/types/event-logger";
import { Metadata } from "@/contracts/types/metadata";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { Contract, ContractParams } from "@/contracts/types/contract";
import { ExtendedMap } from "@/contracts/utils/extended-map";
import { zUtils } from "@/contracts/utils/zod";
import { LRC20 } from "@/contracts/standards/LRC-20";

export class LRC20Base implements Contract, LRC20 {
  _alreadyMinted = false;
  _totalSupply = 0n;
  _allowance = new Map<string, Map<string, bigint>>(); // owner -> spender -> allowance
  _balance = new ExtendedMap<string, bigint>();

  constructor(
    protected _name: string,
    protected _symbol: string,
    protected _decimals: number,
    protected _owner: string,
    public activeOn: number,
  ) {}

  // *** MUTATIONS ***

  async mint({ metadata, eventLogger, args }: ContractParams) {
    await this.mintLogic(args, metadata, eventLogger);
  }

  async transfer({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [to, value] = argsParsing(schema, args, "transfer");
    await this.transferLogic(metadata.sender, to, value, eventLogger);
  }

  async transferFrom({ metadata, eventLogger, args }: ContractParams) {
    console.log(args, metadata);
    const schema = z.tuple([z.string(), z.string(), zUtils.bigint()]);
    const [from, to, value] = argsParsing(schema, args, "transferFrom");

    const fromAllowances =
      this._allowance.get(from) ?? new Map<string, bigint>();
    const allowance = fromAllowances.get(metadata.sender) ?? 0n;
    if (allowance < value) {
      throw new ExecutionError(
        "transferFrom: allowance for spender not enough",
      );
    }

    await this.transferLogic(from, to, value, eventLogger);

    // decrease allowance
    fromAllowances.set(metadata.sender, allowance - value);
  }

  async approve({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [spender, value] = argsParsing(schema, args, "approve");

    const myAllowances =
      this._allowance.get(metadata.sender) ?? new Map<string, bigint>();
    myAllowances.set(spender, value);
    this._allowance.set(metadata.sender, myAllowances);

    eventLogger.log({
      type: "APPROVE",
      message: `OWNER: '${metadata.sender}'; SPENDER: '${spender}'; VALUE: ${value}`,
    });
  }

  // *** QUERIES ***

  name() {
    return this._name;
  }

  symbol() {
    return this._symbol;
  }

  decimals() {
    return this._decimals;
  }

  totalSupply() {
    return this._totalSupply;
  }

  balanceOf({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "balanceOf");

    return this._balance.get(from) ?? 0n;
  }

  allowance({ args }: ContractParams) {
    const schema = z.tuple([z.string(), z.string()]);
    const [owner, spender] = argsParsing(schema, args, "allowance");

    return this._allowance.get(owner)?.get(spender) ?? 0n;
  }

  protected async mintLogic(
    args: unknown[],
    metadata: Metadata,
    eventLogger: EventLogger,
  ) {
    const schema = z.tuple([zUtils.bigint()]);
    const [amount] = argsParsing(schema, args, "mint");

    if (metadata.sender !== this._owner)
      throw new ExecutionError("mint: only the owner can mint");
    if (this._alreadyMinted)
      throw new ExecutionError("mint: already minted; can only be done once");

    this._balance.set(metadata.sender, amount);
    this._alreadyMinted = true;
    this._totalSupply = amount;
    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: 0x0; TO: '${metadata.sender}'; VALUE: ${amount}`,
    });
  }

  /**
   * this is responsible for transferring tokens from one address to another.
   * it is used for both transfer and transferFrom, for transferFrom the allowance check has already succeeded if we reach this method
   *
   * only this method needs to be overwritten if you want to change the transfer logic
   */
  protected async transferLogic(
    from: string,
    to: string,
    value: bigint,
    eventLogger: EventLogger,
  ) {
    const currentBalanceFrom = this._balance.get(from) ?? 0n;
    if (value > currentBalanceFrom)
      throw new ExecutionError("transfer: balance to small");

    this._balance.set(from, currentBalanceFrom - value);
    this._balance.update(
      to,
      0n,
      (currentBalanceTo) => currentBalanceTo + value,
    );

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '${from}'; TO: '${to}'; VALUE: ${value}`,
    });
  }
}
