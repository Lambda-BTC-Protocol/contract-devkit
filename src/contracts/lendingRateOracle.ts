import { z } from "zod";
import { Contract, ContractParams } from "./types/contract";
import { zUtils } from "./utils/zod";
import { argsParsing } from "./utils/args-parsing";
import { EventTypes } from "./aave/libraries/types/dataTypes";

export default class LendingRateOracle implements Contract {
  activeOn: number = 100;
  private _borrowRates: Map<string, bigint> = new Map();
  private _owner: string | null = null;

  owner(): string | null {
    return this._owner;
  }

  constructor() {}

  init({ metadata }: ContractParams): void {
    this._owner = metadata.sender;
  }

  private _onlyOwner(sender: string): void {
    if (sender !== this._owner) {
      throw new Error("Ownable: caller is not the owner");
    }
  }

  /**
   * @dev Retrieves the current market borrow rate for a given asset.
   * @param asset The address of the asset for which to retrieve the borrow rate.
   * @return The market borrow rate as a bigint.
   */
  getMarketBorrowRate(asset: string): bigint {
    const rate = this._borrowRates.get(asset);
    return rate || BigInt(0);
  }

  /**
   * @dev Allows the current owner to renounce ownership of the contract.
   * This will set the owner to an empty string.
   * @param metadata The metadata containing sender information.
   */
  renounceOwnership({ metadata }: ContractParams): void {
    this._onlyOwner(metadata.sender);
    this._owner = "";
  }

  /**
   * @dev Transfers ownership of the contract to a new owner.
   * Only the current owner can call this function.
   * @param metadata The metadata containing sender information.
   * @param args The arguments containing the new owner's address.
   * @param eventLogger The logger to record the event.
   * @param ecosystem The ecosystem context.
   */
  transferOwnership({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): void {
    this._onlyOwner(metadata.sender);

    const schema = z.tuple([z.string()]);
    const [newOwner] = argsParsing(schema, args, "transferOwnership");

    if (newOwner === "") {
      throw new Error("Ownable: new owner is the zero address");
    }

    this._owner = newOwner;
  }

  /**
   * @dev Sets the market borrow rate for a specific asset.
   * Only the current owner can call this function.
   * @param metadata The metadata containing sender information.
   * @param args The arguments containing the asset address and the new borrow rate.
   * @param eventLogger The logger to record the event.
   * @param ecosystem The ecosystem context.
   */
  setMarketBorrowRate({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): void {
    this._onlyOwner(metadata.sender);
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [asset, rate] = argsParsing(schema, args, "setMarketBorrowRate");

    this._borrowRates.set(asset, rate);

    eventLogger.log({
      type: EventTypes.MARKET_BORROW_RATE_CHANGED,
      message: `MarketBorrowRateSet: asset ${asset}, rate ${rate.toString()}`,
    });
  }
}
