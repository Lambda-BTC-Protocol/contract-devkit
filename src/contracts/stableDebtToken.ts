import { ContractParams, Contract } from "./types/contract";
import { bigint, number, z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { zUtils } from "@/contracts/utils/zod";
import { LRC20Base } from "./standards/base/LRC20Base";
import { Metadata } from "./types/metadata";
import { ExecutionError } from "./types/execution-error";
import { MathUtils } from "./libraries/math/mathUtils";
import { WadRayMath } from "./libraries/math/wadRayMath";

interface InitializableContract extends Contract {
  isInitialized(): boolean; // Add a method to check initialization status
  init(args: unknown[], metadata: Metadata): Promise<void>;
}
class LandingPool {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  getReserveNormalizedVariableDebt() {
    //todo
    return 0n;
  }
}

export class StableDebtToken
  extends LRC20Base
  implements InitializableContract
{
  private _isInitialized = false;
  activeOn = 100;
  private _balances: Map<string, bigint> = new Map();
  private _borrowAllowances: Map<string, Map<string, bigint>> = new Map();
  private _pool: LandingPool = new LandingPool("");
  private _underlyingAsset: string = "";
  private _incentivesController: string = "";

  private admin: string = "walletA";

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

  calcTotalSupply(avgRate: bigint): bigint {
    const principalSupply = super.totalSupply();
    if (principalSupply === BigInt(0)) {
      return BigInt(0);
    }

    const cumulatedInterest = MathUtils.calculateCompoundedInterest(
      avgRate,
      this._totalSupplyTimestamp
    );
    return WadRayMath.rayMul(principalSupply, cumulatedInterest);
  }

  getSupplyData() {
    const avgRate = this._avgStableRate;

    return {
      totalSupply: super.totalSupply(),
      calcTotalSupply: this.calcTotalSupply(avgRate),
      avgRate: avgRate,
      lastUpdateTimestamp: this._totalSupplyTimestamp,
    };
  }

  private onlyLendingPool(sender: string): void {
    if (sender !== this._pool.name) {
      throw new ExecutionError("Only landing pool can do this");
    }
  }
  async init(args: any[]) {
    const schema = z.tuple([
      z.string(),
      z.string(),
      z.number(),
      z.string(),
      z.string(),
      z.string(),
    ]);
    const [
      name,
      symbol,
      decimals,
      pool,
      underlyingAsset,
      incentivesController,
    ] = argsParsing(schema, args, "init");

    this._name = name;
    this._symbol = symbol;
    this._decimals = decimals;
    this._underlyingAsset = underlyingAsset;
    this._pool.name = pool;
    this._incentivesController = incentivesController;

    console.log(
      `Initialized variableDebtToken with name: ${this._name}, symbol: ${this._symbol}`
    );
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

  isInitialized(): boolean {
    return this._isInitialized;
  }

  async _decreaseBorrowAllowance(
    delegator: string,
    delegatee: string,
    amount: bigint
  ) {
    let allowance = this._borrowAllowances.get(delegator)?.get(delegatee);
    if (!allowance) {
      allowance = 0n;
    }
    const newAllowance: bigint = allowance - amount;
    if (newAllowance < 0n) {
      throw new ExecutionError("BORROW_ALLOWANCE_NOT_ENOUGH");
    }
    this._borrowAllowances.get(delegator)!.set(delegatee, newAllowance);
  }

  /**
   * Burn tokens from a user
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @returns void
   */

  burn({ metadata, args }: ContractParams): void {
    this.onlyLendingPool(metadata.sender);
    const schema = z.tuple([z.string(), zUtils.bigint(), zUtils.bigint()]);
    const [user, amount, index] = argsParsing(schema, args, "burn");

    const amountScaled = amount / index;
    if (amountScaled == 0n) {
      throw new ExecutionError("CT_INVALID_MINT_AMOUNT");
    }

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

export default StableDebtToken;
