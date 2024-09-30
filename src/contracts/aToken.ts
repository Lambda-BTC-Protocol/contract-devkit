import { ContractParams, Contract } from "./types/contract";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { zUtils } from "@/contracts/utils/zod";
import { LRC20Base } from "./standards/base/LRC20Base";
import { Metadata } from "./types/metadata";
import { Errors } from "./libraries/helpers/errors";

interface InitializableContract extends Contract {
  isInitialized(): boolean; // Add a method to check initialization status
  init(args: unknown[], metadata: Metadata): Promise<void>;
}

export class aToken extends LRC20Base implements InitializableContract {
  private _isInitialized = false;
  activeOn = 100;
  private _balances: Map<string, bigint> = new Map();

  private admin: string = "walletA";
  /**
   * Only whitelisted users can call this function
   * @param user - User to check
   * @throws Error if user is not whitelisted
   * @returns void
   */
  constructor() {
    super("", "", 0, "", 100); // Pass empty/default values to the base constructor
  }

  /**
   * Mints tokens to the reserve treasury
   * Only callable by the LendingPool
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   */
  // mintToTreasury({ metadata, args }: ContractParams): void {
  //   const schema = z.tuple([zUtils.bigint(), zUtils.bigint()]);
  //   const [amount, index] = argsParsing(schema, args, "mintToTreasury");
  //   if (amount === 0n) {
  //     return;
  //   }

  //   const treasury = this._treasury;

  //   // No rounding error checks here, as per original contract comment
  //   const mintAmount = amount.dividedBy(index);

  //   this._mint(treasury, mintAmount);
  // }

  /**
   * Internal function that mints tokens to a given account
   * @param account The address receiving the minted tokens
   * @param amount The amount of tokens to mint
   */
  private _mint(account: string, amount: bigint): void {
    if (account === '0x0') {
      throw new Error("Mint to Zero address");
    }

    // Increase total supply
    const oldTotalSupply = this._totalSupply;
    this._totalSupply = oldTotalSupply + (amount);

    // Update the balance of the account
    const oldAccountBalance = this._balances.get(account) || BigInt(0);
    this._balances.set(account, oldAccountBalance + (amount));

    // Handle incentives if applicable
    // const incentivesController = this._getIncentivesController();
    // if (incentivesController) {
    //   incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    // }
  }

  private onlyWhitelisted(user: string): void {
    const whitelisted = [this.admin, "pool"];
    if (!whitelisted.includes(user)) {
      throw new Error(`Caller is not admin`);
    }
  }
  async init(args: any[]) {
    const schema = z.tuple([z.string(), z.string(), zUtils.bigint()]);
    const [to, _symbol, amount] = argsParsing(schema, args, "init");

    this._name = to;
    this._symbol = _symbol;
    this._totalSupply = amount;
    this._balances.set(to, amount); // Mint initial supply to the specified address

    console.log(
      `Initialized aToken with name: ${this._name}, symbol: ${this._symbol}, and initial supply: ${this._totalSupply}`
    );
  }

  /**
   * Mint tokens to a user
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @returns void
   */

  async mintLogic(args: unknown[], metadata: Metadata) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [to, amount] = argsParsing(schema, args, "mint");

    // this.onlyWhitelisted(metadata.sender);

    const currentBalance = this._balances.get(to) ?? 0n;
    console.log("HERE", currentBalance, amount);
    this._balances.set(to, currentBalance + amount);
    console.log(`Minted ${amount} ${this.symbol} to ${to}`);
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Burn tokens from a user
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @returns void
   */

  burn({ metadata, args }: ContractParams): void {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [user, amount] = argsParsing(schema, args, "burn");

    // this.onlyWhitelisted(metadata.sender);

    const currentBalance = this._balances.get(user) ?? 0n;
    if (currentBalance < amount) {
      throw new Error(`Burn: not enough balance`);
    }
    this._balances.set(user, currentBalance - amount);
    console.log(`Burned ${amount} ${this.symbol} from ${user}`);
  }

  /**
   * Get the balance of a user
   * @param args - Arguments for the contract
   * @returns Balance of the user
   * @throws Error if user is not found
   * @returns Balance of the user
   */

  balanceOf({ args }: ContractParams): bigint {
    const schema = z.tuple([z.string()]);
    const [user] = argsParsing(schema, args, "balanceOf");

    return this._balances.get(user) ?? 0n;
  }
}

export default aToken;
