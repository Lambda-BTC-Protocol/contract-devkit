import { ContractParams } from "./types/contract";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { zUtils } from "@/contracts/utils/zod";
import { LRC20Base } from "./standards/base/LRC20Base";
import { Errors } from "./aave/libraries/helpers/errors";
import { WadRayMath } from "./aave/libraries/math/wadRayMath";
import { loadContract } from "@/lib/utils";
import { EventTypes } from "./aave/libraries/types/dataTypes";
import { ExecutionError } from "./types/execution-error";

export default class AToken extends LRC20Base {
  activeOn = 100;
  private _isInitialized = false;
  private _balances: Map<string, bigint> = new Map();
  protected _admin: string = "";
  protected _treasury: string = "";
  protected _pool: string = "lendingPool";
  protected _underlyingAsset: string = "";
  protected _underlyingAssetDecimals: number = 0;
  protected _name: string = "";
  protected _symbol: string = "";

  constructor() {
    super("", "", 0, "", 0); // Pass empty/default values to the base constructor
  }

  private _onlyLendingPool(sender: string): void {
    const lendingPool = this._pool;
    if (sender !== lendingPool) {
      throw new Error("Caller is not the lending pool");
    }
  }

  private _onlyInitialized(): void {
    if (!this._isInitialized) {
      throw new Error("Token is not initialized");
    }
  }

  /**
   * @dev Checks if the aToken contract has been initialized.
   * This function returns a boolean indicating whether the
   * contract is in an initialized state.
   *
   * @return A boolean value:
   *  - `true` if the contract is initialized,
   *  - `false` otherwise.
   */
  isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * @dev Invoked to execute actions on the aToken side after a repayment.
   * @param user The user executing the repayment
   * @param amount The amount getting repaid
   **/
  handleRepayment({ metadata }: ContractParams): void {
    this._onlyLendingPool(metadata.sender);
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

  /**
   * Mints tokens to the reserve treasury
   * Only callable by the LendingPool
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   */
  mintToTreasury({ args, metadata, eventLogger }: ContractParams): void {
    this._onlyInitialized();
    this._onlyLendingPool(metadata.sender);

    const schema = z.tuple([zUtils.bigint(), zUtils.bigint()]);
    const [amount, index] = argsParsing(schema, args, "mintToTreasury");
    if (amount === 0n) {
      return;
    }

    const treasury = this._treasury;

    const mintAmount = WadRayMath.rayDiv(amount, index);

    this._mint(treasury, mintAmount);

    eventLogger.log({
      type: EventTypes.MINTED_TO_TREASURY,
      message: `Minted ${mintAmount.toString()} tokens to treasury with new liquidity index ${index.toString()}`,
    });
  }

  /**
   * Mints `amount` of aTokens to `user`
   * - Only callable by the LendingPool
   * @param args The arguments for the contract
   * @param metadata Metadata which contains the sender's address
   * @returns `true` if the previous balance of the user was 0
   */
  async mintAToken({
    args,
    metadata,
    eventLogger,
  }: ContractParams): Promise<boolean> {
    this._onlyInitialized();
    this._onlyLendingPool(metadata.sender);

    const schema = z.tuple([z.string(), zUtils.bigint(), zUtils.bigint()]);
    const [user, amount, index] = argsParsing(schema, args, "mint");

    const previousBalance = this._balances.get(user) ?? 0n;
    const amountScaled = WadRayMath.rayDiv(amount, index);

    if (amountScaled === 0n) {
      throw new Error(Errors.CT_INVALID_MINT_AMOUNT);
    }

    this._mint(user, amountScaled);

    eventLogger.log({
      type: EventTypes.MINTED,
      message: `Minted ${amountScaled.toString()} aTokens for user ${user} at liquidity index ${index.toString()}`,
    });

    return previousBalance === 0n;
  }

  /**
   * @dev Transfers the underlying asset to `target`. Used by the LendingPool to transfer
   * assets in borrow(), withdraw() and flashLoan()
   * @param target The recipient of the aTokens
   * @param amount The amount getting transferred
   * @return The amount transferred
   **/
  async transferUnderlyingTo({
    args,
    ecosystem,
    metadata,
    eventLogger,
  }: ContractParams): Promise<void> {
    this._onlyInitialized();
    this._onlyLendingPool(metadata.sender);

    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [target, amount] = argsParsing(schema, args, "transferUnderlyingTo");

    const underlyingAssetInctance = await loadContract<LRC20Base>(
      ecosystem,
      this._underlyingAsset
    );

    await underlyingAssetInctance.transfer([target, amount]);

    eventLogger.log({
      type: EventTypes.TRANSFERRED,
      message: `Transferred ${amount.toString()} of underlying asset to ${target}`,
    });
  }

  /**
   * Internal function that mints tokens to a given account
   * @param account The address receiving the minted tokens
   * @param amount The amount of tokens to mint
   */
  private _mint(account: string, amount: bigint): void {
    if (!account) {
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
   * @dev Initializes the aToken contract with the specified parameters.
   * This function sets up the treasury, pool, underlying asset,
   * asset decimals, aToken name, and symbol. It also marks the
   * contract as initialized.
   *
   * @param args The initialization parameters, including:
   *  - treasury: The address of the treasury.
   *  - pool: The address of the associated lending pool.
   *  - underlyingAsset: The address of the underlying asset.
   *  - underlyingAssetDecimals: The number of decimals for the underlying asset.
   *  - aTokenName: The name of the aToken.
   *  - aTokenSymbol: The symbol of the aToken.
   * @param metadata Additional metadata about the transaction.
   * @param eventLogger Logger for logging events during initialization.
   */
  async init({ args, metadata, eventLogger }: ContractParams) {
    if (this._isInitialized) {
      throw new ExecutionError("AToken already initialized");
    }

    const schema = z.tuple([
      z.string(),
      z.string(),
      z.string(),
      z.number(),
      z.string(),
      z.string(),
    ]);
    const [
      treasury,
      pool,
      underlyingAsset,
      underlyingAssetDecimals,
      aTokenName,
      aTokenSymbol,
    ] = argsParsing(schema, args, "init");

    this._treasury = treasury;
    this._pool = pool;
    this._underlyingAsset = underlyingAsset;
    this._underlyingAssetDecimals = underlyingAssetDecimals;
    this._name = aTokenName;
    this._symbol = aTokenSymbol;
    this._decimals = underlyingAssetDecimals;
    this._isInitialized = true;

    eventLogger.log({
      type: EventTypes.INITIALIZED,
      message: `Initialized aToken with name: ${this._name}, symbol: ${this._symbol}, and initial supply: ${this._totalSupply}`,
    });
  }

  /**
   * @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
   * - Only callable by the LendingPool, as extra state updates there need to be managed
   * @param user The owner of the aTokens, getting them burned
   * @param receiverOfUnderlying The address that will receive the underlying
   * @param amount The amount being burned
   * @param index The new liquidity index of the reserve
   */
  async burn({
    metadata,
    args,
    ecosystem,
    eventLogger,
  }: ContractParams): Promise<void> {
    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);
    const [user, receiverOfUnderlying, amount, index] = argsParsing(
      schema,
      args,
      "burn"
    );

    const amountScaled = WadRayMath.rayDiv(amount, index);

    if (amountScaled === 0n) {
      throw new Error(Errors.CT_INVALID_BURN_AMOUNT);
    }

    this._burn({
      args: [user, amountScaled],
      ecosystem,
      eventLogger,
      metadata,
    });

    eventLogger.log({
      type: EventTypes.BURNED,
      message: `Burned ${amountScaled.toString()} tokens from user: ${user} to receiver: ${receiverOfUnderlying}.`,
    });

    const currentBalance = this._balances.get(user) ?? 0n;
    if (currentBalance < amount) {
      throw new Error(`Burn: not enough balance`);
    }
    const underlyingAssetInctance = await loadContract<LRC20Base>(
      ecosystem,
      this._underlyingAsset
    );
    await underlyingAssetInctance.transfer([receiverOfUnderlying, amount]);
  }

  /**
   * Burn tokens from a user
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @returns void
   */
  private _burn({ metadata, args }: ContractParams): void {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [user, amount] = argsParsing(schema, args, "burn");

    const currentBalance = this._balances.get(user) ?? 0n;
    if (currentBalance < amount) {
      throw new Error(`Burn: not enough balance`);
    }
    this._balances.set(user, currentBalance - amount);
  }
}
