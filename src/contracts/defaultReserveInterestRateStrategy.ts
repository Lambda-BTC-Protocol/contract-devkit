import { z } from "zod";
import { WadRayMath } from "./aave/libraries/math/wadRayMath";
import { Contract, ContractParams } from "./types/contract";
import { zUtils } from "./utils/zod";
import { argsParsing } from "./utils/args-parsing";
import { LRC20Base } from "./standards/base/LRC20Base";
import { PercentageMath } from "./aave/libraries/math/percentageMath";
import { Ecosystem } from "./types/ecosystem";
import LendingRateOracle from "./lendingRateOracle";
import { loadContract } from "@/lib/utils";
import { CalcInterestRatesLocalVars } from "./aave/libraries/types/dataTypes";

export default class DefaultReserveInterestRateStrategy implements Contract {
  activeOn: number = 100;
  private _optimalUtilizationRate: bigint = 450000000000000000000000000n;
  private _excessUtilizationRate: bigint =
    WadRayMath.ray() - this._optimalUtilizationRate;
  private _baseVariableBorrowRate: bigint = 30000000000000000000000000n;
  private _variableRateSlope1: bigint = 100000000000000000000000000n;
  private _variableRateSlope2: bigint = 3000000000000000000000000000n;
  private _stableRateSlope1: bigint = 100000000000000000000000000n;
  private _stableRateSlope2: bigint = 3000000000000000000000000000n;
  private _lendingRateOracle = "lendingRateOracle";

  /**
   * @dev Initializes the interest rate strategy with specified parameters.
   * @param optimalUtilizationRate The optimal utilization rate for the reserve.
   * @param baseVariableBorrowRate The base rate for variable borrowing.
   * @param variableRateSlope1 The first slope for variable rates.
   * @param variableRateSlope2 The second slope for variable rates.
   * @param stableRateSlope1 The first slope for stable rates.
   * @param stableRateSlope2 The second slope for stable rates.
   */
  async init(
    optimalUtilizationRate: bigint,
    baseVariableBorrowRate: bigint,
    variableRateSlope1: bigint,
    variableRateSlope2: bigint,
    stableRateSlope1: bigint,
    stableRateSlope2: bigint
  ) {
    this._optimalUtilizationRate = optimalUtilizationRate;
    this._excessUtilizationRate = WadRayMath.ray() - optimalUtilizationRate;
    this._baseVariableBorrowRate = baseVariableBorrowRate;
    this._variableRateSlope1 = variableRateSlope1;
    this._variableRateSlope2 = variableRateSlope2;
    this._stableRateSlope1 = stableRateSlope1;
    this._stableRateSlope2 = stableRateSlope2;
  }

  /**
   * @dev Returns the first slope for variable interest rates.
   * @return The variable rate slope 1 as a bigint.
   */
  getVariableRateSlope1(): bigint {
    return this._variableRateSlope1;
  }

  /**
   * @dev Returns the second slope for variable interest rates.
   * @return The variable rate slope 2 as a bigint.
   */
  getVariableRateSlope2(): bigint {
    return this._variableRateSlope2;
  }

  /**
   * @dev Returns the first slope for stable interest rates.
   * @return The stable rate slope 1 as a bigint.
   */
  getStableRateSlope1(): bigint {
    return this._stableRateSlope1;
  }

  /**
   * @dev Returns the second slope for stable interest rates.
   * @return The stable rate slope 2 as a bigint.
   */
  getStableRateSlope2(): bigint {
    return this._stableRateSlope2;
  }

  /**
   * @dev Returns the base variable borrow rate.
   * @return The base variable borrow rate as a bigint.
   */
  getBaseVariableBorrowRate(): bigint {
    return this._baseVariableBorrowRate;
  }

  /**
   * @dev Calculates the maximum variable borrow rate.
   * @return The maximum variable borrow rate as a bigint.
   */
  getMaxVariableBorrowRate(): bigint {
    return (
      this._baseVariableBorrowRate +
      this._variableRateSlope1 +
      this._variableRateSlope2
    );
  }

  /**
   * @dev Calculates the interest rates based on provided parameters.
   * @param metadata The metadata containing sender information.
   * @param args The arguments containing various parameters for interest calculation.
   * @param eventLogger The logger to record the event.
   * @param ecosystem The ecosystem context.
   * @return A tuple containing the current liquidity rate, stable borrow rate, and variable borrow rate.
   */
  async calculateInterestRates({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<[bigint, bigint, bigint]> {
    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);

    const [
      reserve,
      aToken,
      liquidityAdded,
      liquidityTaken,
      totalStableDebt,
      totalVariableDebt,
      averageStableBorrowRate,
      reserveFactor,
    ] = argsParsing(schema, args, "deposit");

    const reserveToken = await loadContract<LRC20Base>(ecosystem, reserve);

    const availableLiquidity =
      reserveToken.balanceOf([aToken]) + liquidityAdded - liquidityTaken;

    return this._calculateInterestRatesInternal(
      reserve,
      availableLiquidity,
      totalStableDebt,
      totalVariableDebt,
      averageStableBorrowRate,
      reserveFactor,
      ecosystem
    );
  }

  /**
   * @dev Internal function to calculate interest rates based on various inputs.
   * @param reserve The address of the reserve asset.
   * @param availableLiquidity The amount of available liquidity in the reserve.
   * @param totalStableDebt The total stable debt in the reserve.
   * @param totalVariableDebt The total variable debt in the reserve.
   * @param averageStableBorrowRate The average stable borrow rate.
   * @param reserveFactor The reserve factor.
   * @param ecosystem The ecosystem context.
   * @return A tuple containing the current liquidity rate, stable borrow rate, and variable borrow rate.
   */
  private async _calculateInterestRatesInternal(
    reserve: string,
    availableLiquidity: bigint,
    totalStableDebt: bigint,
    totalVariableDebt: bigint,
    averageStableBorrowRate: bigint,
    reserveFactor: bigint,
    ecosystem: Ecosystem
  ): Promise<[bigint, bigint, bigint]> {
    const vars: CalcInterestRatesLocalVars = {
      currentLiquidityRate: 0n,
      currentStableBorrowRate: 0n,
      currentVariableBorrowRate: 0n,
      totalDebt: 0n,
      utilizationRate: 0n,
    };
    vars.totalDebt = totalStableDebt + totalVariableDebt;

    vars.utilizationRate =
      vars.totalDebt === 0n
        ? 0n
        : (vars.totalDebt * WadRayMath.ray()) /
          (availableLiquidity + vars.totalDebt);

    const lendingRateOracle = await loadContract<LendingRateOracle>(
      ecosystem,
      this._lendingRateOracle
    );

    vars.currentStableBorrowRate = lendingRateOracle.getMarketBorrowRate([
      reserve,
    ]);

    if (BigInt(vars.utilizationRate) > this._optimalUtilizationRate) {
      const excessUtilizationRateRatio =
        (BigInt(vars.utilizationRate) - this._optimalUtilizationRate) /
        this._excessUtilizationRate;

      vars.currentStableBorrowRate =
        vars.currentStableBorrowRate +
        this._stableRateSlope1 +
        this._stableRateSlope2 * excessUtilizationRateRatio;
      vars.currentVariableBorrowRate =
        this._baseVariableBorrowRate +
        this._variableRateSlope1 +
        this._variableRateSlope2 * excessUtilizationRateRatio;
    } else {
      vars.currentStableBorrowRate =
        vars.currentStableBorrowRate +
        this._stableRateSlope1 *
          (BigInt(vars.utilizationRate) / this._optimalUtilizationRate);

      vars.currentVariableBorrowRate =
        this._baseVariableBorrowRate +
        (vars.utilizationRate * this._variableRateSlope1) /
          this._optimalUtilizationRate;
    }

    vars.currentLiquidityRate = WadRayMath.rayMul(
      WadRayMath.rayMul(
        this._getOverallBorrowRate(
          totalStableDebt,
          totalVariableDebt,
          vars.currentVariableBorrowRate,
          averageStableBorrowRate
        ),
        vars.utilizationRate
      ),
      BigInt(PercentageMath.PERCENTAGE_FACTOR) - reserveFactor
    );

    return [
      vars.currentLiquidityRate,
      vars.currentStableBorrowRate,
      vars.currentVariableBorrowRate,
    ];
  }

  /**
   * @dev Calculates the overall borrow rate based on stable and variable debt.
   * @param totalStableDebt The total stable debt.
   * @param totalVariableDebt The total variable debt.
   * @param currentVariableBorrowRate The current variable borrow rate.
   * @param currentAverageStableBorrowRate The current average stable borrow rate.
   * @return The overall borrow rate as a bigint.
   */
  private _getOverallBorrowRate(
    totalStableDebt: bigint,
    totalVariableDebt: bigint,
    currentVariableBorrowRate: bigint,
    currentAverageStableBorrowRate: bigint
  ): bigint {
    const totalDebt = totalStableDebt + totalVariableDebt;
    if (totalDebt === 0n) return 0n;

    const weightedVariableRate = totalVariableDebt * currentVariableBorrowRate;
    const weightedStableRate = totalStableDebt * currentAverageStableBorrowRate;

    return (weightedVariableRate + weightedStableRate) / totalDebt;
  }
}
