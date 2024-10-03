import { ContractParams, Contract } from "./types/contract";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { zUtils } from "@/contracts/utils/zod";
import { LRC20Base } from "./standards/base/LRC20Base";
import { Metadata } from "./types/metadata";
import { ExecutionError } from "./types/execution-error";
import { Ecosystem } from "./types/ecosystem";
import { WadRayMath } from "./aave/libraries/math/wadRayMath";
import { Errors } from "./aave/libraries/helpers/errors";
import { EventTypes } from "./aave/libraries/types/dataTypes";
import LendingPool from "./lendingPool";
import { loadContract } from "@/lib/utils";

export default class VariableDebtToken extends LRC20Base implements Contract {
  private _isInitialized = false;
  activeOn = 100;
  private _balances: Map<string, bigint> = new Map();
  private _borrowAllowances: Map<string, Map<string, bigint>> = new Map();
  private _pool = "";
  private _underlyingAsset: string = "";
  private _underlyingAssetDecimals: number = 0;

  private admin: string = "walletA";

  constructor() {
    super("", "", 0, "", 100); // Pass empty/default values to the base constructor
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  private onlyLendingPool(sender: string): void {
    if (sender !== this._pool) {
      throw new ExecutionError("Only landing pool can do this");
    }
  }

  /**
   * @dev Initializes the debt token.
   * @param pool The address of the lending pool where this aToken will be used
   * @param underlyingAsset The address of the underlying asset of this aToken (E.g. WETH for aWETH)
   * @param underlyingAssetDecimals The decimals of the debtToken, same as the underlying asset's
   * @param variableDeptTokenName The name of the token
   * @param variableDeptTokenSymbol The symbol of the token
   */
  async init({ args, metadata, eventLogger }: ContractParams) {
    if (this._isInitialized) {
      throw new ExecutionError("VariableDebtToken already initialized");
    }

    const schema = z.tuple([
      z.string(),
      z.string(),
      z.number(),
      z.string(),
      z.string(),
    ]);
    const [
      pool,
      underlyingAsset,
      underlyingAssetDecimals,
      variableDeptTokenName,
      variableDeptTokenSymbol,
    ] = argsParsing(schema, args, "init");

    this._name = variableDeptTokenName;
    this._symbol = variableDeptTokenSymbol;
    this._decimals = underlyingAssetDecimals;
    this._underlyingAssetDecimals = underlyingAssetDecimals;
    this._underlyingAsset = underlyingAsset;
    this._pool = pool;
    this._isInitialized = true;

    eventLogger.log({
      type: EventTypes.INITIALIZED,
      message: `Initialized variableDebtToken with name: ${this._name}, symbol: ${this._symbol}`,
    });
  }

  /**
   * Mints `amount` of variableDebtToken to `user`
   * - Only callable by the LendingPool
   * @param args The arguments for the contract
   * @param metadata Metadata which contains the sender's address
   * @returns `true` if the previous balance of the user was 0
   */
  async mintVariableDeptToken({
    args,
    metadata,
    eventLogger,
  }: ContractParams): Promise<boolean> {
    this.onlyLendingPool(metadata.sender);

    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);
    const [user, onBehalfOf, amount, index] = argsParsing(
      schema,
      args,
      "mintVariableDeptToken"
    );

    if (user !== onBehalfOf) {
      this._decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    const previousBalance = this._balances.get(onBehalfOf) ?? 0n;
    const amountScaled = WadRayMath.rayDiv(amount, index);

    if (amountScaled === 0n) {
      throw new Error(Errors.CT_INVALID_MINT_AMOUNT);
    }

    this._mint(onBehalfOf, amountScaled);

    eventLogger.log({
      type: EventTypes.MINTED,
      message: `Mint: user: ${onBehalfOf}, amount: ${amount}, index: ${index}`,
    });

    return previousBalance === 0n;
  }

  /**
   * Internal function that mints tokens to a given account
   * @param account The address receiving the minted tokens
   * @param amount The amount of tokens to mint
   */
  private _mint(account: string, amount: bigint): void {
    if (account === "0x0") {
      throw new Error("Mint to Zero address");
    }

    // Increase total supply
    const oldTotalSupply = this._totalSupply;
    this._totalSupply = oldTotalSupply + amount;

    // Update the balance of the account
    const oldAccountBalance = this._balances.get(account) || BigInt(0);
    this._balances.set(account, oldAccountBalance + amount);
  }

  /**
   * Mint tokens to a user
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @returns void
   */
  async mintLogic(args: unknown[], metadata: Metadata): Promise<void> {
    this.onlyLendingPool(metadata.sender);
    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);
    const [user, onBehalfOf, amount, index] = argsParsing(schema, args, "mint");
    if (user != onBehalfOf) {
      await this._decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    // const previousBalance = this._balances.get(onBehalfOf) ?? 0n;
    const amountScaled = amount / index;
    if (amountScaled == 0n) {
      throw new ExecutionError("CT_INVALID_MINT_AMOUNT");
    }
    const currentBalance = this._balances.get(onBehalfOf) ?? 0n;
    this._balances.set(onBehalfOf, currentBalance + amount);
  }

  private _decreaseBorrowAllowance(
    delegator: string,
    delegatee: string,
    amount: bigint
  ): void {
    if (
      (this._borrowAllowances.get(delegator)?.get(delegatee) || BigInt(0)) <
      amount
    ) {
      throw new Error(Errors.BORROW_ALLOWANCE_NOT_ENOUGH);
    }
    const newAllowance =
      (this._borrowAllowances.get(delegator)?.get(delegatee) || BigInt(0)) -
      amount;

    this._borrowAllowances.get(delegator)?.set(delegatee, newAllowance);
  }

  /**
   * @dev Returns the total supply of the variable debt token. Represents the total debt accrued by the users
   * @return The total supply
   **/
  public async totalSupplyVDT(ecosystem: Ecosystem): Promise<bigint> {
    const principalSupply = super.totalSupply(); // This would be the equivalent of super.totalSupply()

    const pool = await loadContract<LendingPool>(ecosystem, this._pool);

    const normalizedDebt = pool.getReserveNormalizedVariableDebt([
      this._underlyingAsset,
    ]);

    return WadRayMath.rayMul(principalSupply, normalizedDebt);
  }

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
   * @return the scaled total supply
   **/
  public scaledTotalSupply(): bigint {
    return super.totalSupply();
  }

  /**
   * Burn tokens from a user
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @returns void
   */
  burn({ metadata, args, eventLogger }: ContractParams): void {
    this.onlyLendingPool(metadata.sender);

    const schema = z.tuple([z.string(), zUtils.bigint(), zUtils.bigint()]);
    const [user, amount, index] = argsParsing(schema, args, "burn");

    const amountScaled = amount / index;

    if (amountScaled == 0n) {
      throw new ExecutionError(Errors.CT_INVALID_MINT_AMOUNT);
    }

    const currentBalance = this._balances.get(user) ?? 0n;

    if (currentBalance < amount) {
      throw new Error(`Burn: not enough balance`);
    }

    this._balances.set(user, currentBalance - amount);

    eventLogger.log({
      type: EventTypes.BURNED,
      message: `Burned ${amount} ${this.symbol} from ${user}`,
    });
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
