import { ContractParams, Contract } from "./types/contract";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { zUtils } from "@/contracts/utils/zod";
import { LRC20Base } from "./standards/base/LRC20Base";
import { ExecutionError } from "./types/execution-error";
import { MathUtils } from "./aave/libraries/math/mathUtils";
import { WadRayMath } from "./aave/libraries/math/wadRayMath";
import { EventTypes, MintLocalVars } from "./aave/libraries/types/dataTypes";
import { Errors } from "./aave/libraries/helpers/errors";

export default class StableDebtToken extends LRC20Base implements Contract {
  activeOn = 100;
  private _isInitialized = false;
  private _balances: Map<string, bigint> = new Map();
  private _borrowAllowances: Map<string, Map<string, bigint>> = new Map();
  private _pool: string = "";
  private _underlyingAsset: string = "";
  private _underlyingAssetDecimals: number = 0;
  private _incentivesController: string = "";
  private _avgStableRate: bigint;
  private _timestamps: Map<string, number>;
  private _usersStableRate: Map<string, bigint>;
  private _totalSupplyTimestamp: number;

  constructor() {
    super("", "", 0, "", 100);
    this._avgStableRate = 0n;
    this._timestamps = new Map<string, number>();
    this._usersStableRate = new Map<string, bigint>();
    this._totalSupplyTimestamp = Math.floor(Date.now() / 1000);
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  private _onlyInitialized(): boolean {
    return this._isInitialized;
  }

  private _onlyLendingPool(sender: string): void {
    if (sender !== this._pool) {
      throw new ExecutionError("Only landing pool can do this");
    }
  }

  /**
   * @dev Calculates the total supply
   * @param avgRate The average rate at which the total supply increases
   * @return The debt balance of the user since the last burn/mint action
   **/
  private _calcTotalSupply(avgRate: bigint): bigint {
    const principalSupply = super.totalSupply();
    if (principalSupply === 0n) {
      return 0n;
    }

    const cumulatedInterest = MathUtils.calculateCompoundedInterest(
      avgRate,
      this._totalSupplyTimestamp
    );
    return WadRayMath.rayMul(principalSupply, cumulatedInterest);
  }

  /**
   * @dev Returns the principal and total supply, the average borrow rate and the last supply update timestamp
   **/
  getSupplyData() {
    const avgRate = this._avgStableRate;

    return {
      totalSupply: super.totalSupply(),
      calcTotalSupply: this._calcTotalSupply(avgRate),
      avgRate: avgRate,
      lastUpdateTimestamp: this._totalSupplyTimestamp,
    };
  }

  /**
   * @dev Returns the total supply
   **/
  getTotalSupply() {
    const avgRate = this._avgStableRate;

    return this._calcTotalSupply(avgRate);
  }

  /**
   * @dev Returns the the total supply and the average stable rate
   **/
  getTotalSupplyAndAvgRate() {
    const avgRate = this._avgStableRate;

    return {
      calcTotalSupply: this._calcTotalSupply(avgRate),
      avgRate: avgRate,
    };
  }

  async init({ args, metadata, eventLogger }: ContractParams) {
    if (this._isInitialized) {
      throw new ExecutionError("TableDeptToken already initialized");
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
      stableDeptTokenName,
      stableDeptTokenSymbol,
    ] = argsParsing(schema, args, "init");

    this._pool = pool;
    this._underlyingAsset = underlyingAsset;
    this._underlyingAssetDecimals = underlyingAssetDecimals;

    this._name = stableDeptTokenName;
    this._symbol = stableDeptTokenSymbol;
    this._decimals = underlyingAssetDecimals;
    this._isInitialized = true;

    eventLogger.log({
      type: EventTypes.INITIALIZED,
      message: `Initialized tableDeptToken with name: ${this._name}, symbol: ${this._symbol}, and initial supply: ${this._totalSupply}`,
    });
  }

  /**
   * Mints debt token to the `onBehalfOf` address.
   * - Only callable by the LendingPool
   * - The resulting rate is the weighted average between the rate of the new debt and the rate of the previous debt
   * @param user The address receiving the borrowed underlying
   * @param onBehalfOf The address receiving the debt tokens
   * @param amount The amount of debt tokens to mint
   * @param rate The rate of the debt being minted
   */
  public mintStableDeptToken({
    args,
    metadata,
    ecosystem,
    eventLogger,
  }: ContractParams): boolean {
    this._onlyInitialized();
    this._onlyLendingPool(metadata.sender);

    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);
    const [user, onBehalfOf, amount, rate] = argsParsing(
      schema,
      args,
      "mintStableDeptToken"
    );

    const vars: MintLocalVars = {
      previousSupply: 0n,
      nextSupply: 0n,
      amountInRay: 0n,
      newStableRate: 0n,
      currentAvgStableRate: 0n,
    };

    if (user !== onBehalfOf) {
      this._decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    const [, currentBalance, balanceIncrease] = this._calculateBalanceIncrease({
      args: [onBehalfOf],
      ecosystem,
      eventLogger,
      metadata,
    });

    vars.previousSupply = this._totalSupply;
    vars.currentAvgStableRate = this._avgStableRate;
    vars.nextSupply = this._totalSupply += amount;

    vars.amountInRay = WadRayMath.wadToRay(amount); // Convert amount to ray

    vars.newStableRate =
      WadRayMath.rayMul(
        this._usersStableRate.get(onBehalfOf) || 0n,
        currentBalance
      ) +
      WadRayMath.rayMul(vars.amountInRay, rate) / (currentBalance + amount);

    if (vars.newStableRate > BigInt(2 ** 128 - 1)) {
      throw new Error(Errors.SDT_STABLE_DEBT_OVERFLOW);
    }
    this._usersStableRate.set(onBehalfOf, vars.newStableRate);

    this._totalSupplyTimestamp = Math.floor(metadata.timestamp / 1000); // Store current timestamp in seconds
    this._timestamps.set(onBehalfOf, Number(this._totalSupplyTimestamp));

    // Calculates the updated average stable rate
    vars.currentAvgStableRate = this._avgStableRate =
      WadRayMath.rayMul(vars.currentAvgStableRate, vars.previousSupply) +
      WadRayMath.rayMul(rate, vars.amountInRay) / vars.nextSupply;

    this._mint(onBehalfOf, amount + balanceIncrease, vars.previousSupply);

    eventLogger.log({
      type: EventTypes.MINTED,
      message: `Minted ${amount} stableDeptToken to ${onBehalfOf}, new total supply: ${this._totalSupply}, new average stable rate: ${this._avgStableRate}`,
    });

    return currentBalance === 0n;
  }

  private _decreaseBorrowAllowance(
    delegator: string,
    delegatee: string,
    amount: bigint
  ): void {
    if (
      (this._borrowAllowances.get(delegator)?.get(delegatee) || 0n) < amount
    ) {
      throw new Error(Errors.BORROW_ALLOWANCE_NOT_ENOUGH);
    }
    const newAllowance =
      (this._borrowAllowances.get(delegator)?.get(delegatee) || 0n) - amount;

    this._borrowAllowances.get(delegator)?.set(delegatee, newAllowance);
  }

  /**
   * Calculates the increase in balance since the last user interaction
   * @param user The address of the user for which the interest is being accumulated
   * @return The previous principal balance, the new principal balance, and the balance increase
   */
  private _calculateBalanceIncrease({
    args,
    metadata,
    ecosystem,
    eventLogger,
  }: ContractParams): [bigint, bigint, bigint] {
    const schema = z.tuple([z.string()]);
    const [user] = argsParsing(schema, args, "calculateBalanceIncrease");
    const previousPrincipalBalance = this.balanceOf({
      args: [user],
      ecosystem,
      eventLogger,
      metadata,
    });

    if (previousPrincipalBalance === 0n) {
      return [0n, 0n, 0n];
    }

    // Calculation of the accrued interest since the last accumulation
    const balanceIncrease =
      this.balanceOf({
        args: [user],
        ecosystem,
        eventLogger,
        metadata,
      }) - previousPrincipalBalance;

    return [
      previousPrincipalBalance,
      previousPrincipalBalance + balanceIncrease,
      balanceIncrease,
    ];
  }

  /**
   * Mints stable debt tokens to a user
   * @param account The account receiving the debt tokens
   * @param amount The amount being minted
   * @param oldTotalSupply The total supply before the minting event
   */
  private _mint(account: string, amount: bigint, oldTotalSupply: bigint): void {
    const oldAccountBalance = this._balances.get(account) || 0n;
    this._balances.set(account, oldAccountBalance + amount);
  }

  /**
   * @dev Burns debt of `user`
   * @param user The address of the user getting their debt burned
   * @param amount The amount of debt tokens getting burned
   */
  public async burn({
    args,
    metadata,
    ecosystem,
    eventLogger,
  }: ContractParams): Promise<void> {
    this._onlyInitialized();
    this._onlyLendingPool(metadata.sender);

    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [user, amount] = argsParsing(schema, args, "burn");
    const [_, currentBalance, balanceIncrease] = this._calculateBalanceIncrease(
      { args: [user], metadata, ecosystem, eventLogger }
    );

    const previousSupply = this.totalSupply();
    let newAvgStableRate: bigint = 0n;
    let nextSupply: bigint = 0n;
    const userStableRate = this._usersStableRate.get(user) || 0n;

    // Handle the case where the previous total supply is less than or equal to the burn amount
    if (previousSupply <= amount) {
      this._avgStableRate = 0n;
      this._totalSupply = 0n;
    } else {
      nextSupply = this._totalSupply = previousSupply - amount;
      const firstTerm = WadRayMath.rayMul(
        this._avgStableRate,
        WadRayMath.wadToRay(previousSupply)
      );
      const secondTerm = WadRayMath.rayMul(
        userStableRate,
        WadRayMath.wadToRay(amount)
      );

      // If the second term exceeds the first term, reset to zero to prevent accumulation errors
      if (secondTerm >= firstTerm) {
        newAvgStableRate = this._avgStableRate = this._totalSupply = 0n;
      } else {
        newAvgStableRate = this._avgStableRate = WadRayMath.rayDiv(
          firstTerm - secondTerm,
          WadRayMath.wadToRay(nextSupply)
        );
      }
    }

    // Handle user's balance update
    if (amount === currentBalance) {
      this._usersStableRate.set(user, 0n);
      this._timestamps.set(user, 0);
    } else {
      this._timestamps.set(user, Math.floor(metadata.timestamp / 1000)); // Use current timestamp
    }

    // Update the total supply timestamp
    this._totalSupplyTimestamp = Math.floor(metadata.timestamp / 1000);

    // Mint or burn depending on balance increase
    if (balanceIncrease > amount) {
      const amountToMint = balanceIncrease - amount;
      await this._mint(user, amountToMint, previousSupply);
    } else {
      const amountToBurn = amount - balanceIncrease;
      await this._burn(user, amountToBurn, previousSupply);
    }
  }

  /**
   * @dev Burns stable debt tokens of a user
   * @param account The user getting their debt burned
   * @param amount The amount being burned
   * @param oldTotalSupply The total supply before the burning event
   */
  private _burn(account: string, amount: bigint, oldTotalSupply: bigint): void {
    const oldAccountBalance = this._balances.get(account) || 0n;

    if (oldAccountBalance < amount) {
      throw new Error("Burn exceeds balance");
    }

    // Subtract the burned amount from the user's balance
    this._balances.set(account, oldAccountBalance - amount);
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
