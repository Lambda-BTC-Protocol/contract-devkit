import { Ecosystem } from "@/contracts/types/ecosystem";
import { ReserveConfiguration } from "../configuration/reserveConfiguration";
import { WadRayMath } from "../math/wadRayMath";
import { MathUtils } from "../math/mathUtils";
import { PercentageMath } from "../math/percentageMath";
import { Errors } from "../helpers/errors";
import { loadContract } from "@/lib/utils";
import VariableDebtToken from "@/contracts/variableDebtToken";
import StableDebtToken from "@/contracts/stableDebtToken";
import AToken from "@/contracts/aToken";
import DefaultReserveInterestRateStrategy from "@/contracts/defaultReserveInterestRateStrategy";

export class ReserveData {
  configuration: ReserveConfiguration;
  liquidityIndex: bigint;
  variableBorrowIndex: bigint;
  currentLiquidityRate: bigint;
  currentVariableBorrowRate: bigint;
  currentStableBorrowRate: bigint;
  lastUpdateTimestamp: number;
  aTokenAddress: string;
  stableDebtTokenAddress: string;
  variableDebtTokenAddress: string;
  interestRateStrategyAddress: string;
  id: number | undefined;

  private _reserveInterestRateStrategy = "defaultReserveInterestRateStrategy";

  constructor() {
    (this.configuration = new ReserveConfiguration()),
      (this.liquidityIndex = 0n),
      (this.variableBorrowIndex = 0n),
      (this.currentLiquidityRate = 0n),
      (this.currentVariableBorrowRate = 0n),
      (this.currentStableBorrowRate = 0n),
      (this.lastUpdateTimestamp = 0),
      (this.aTokenAddress = ""),
      (this.stableDebtTokenAddress = ""),
      (this.variableDebtTokenAddress = ""),
      (this.interestRateStrategyAddress = "");
  }

  /**
   * Initializes a reserve object.
   * @param reserve - The reserve object.
   * @param aTokenAddress - The address of the overlying aToken contract.
   * @param stableDebtTokenAddress - The address of the StableDebtToken contract.
   * @param variableDebtTokenAddress - The address of the VariableDebtToken contract.
   * @param interestRateStrategyAddress - The address of the interest rate strategy contract.
   */
  initReserveData(
    reserve: ReserveData,
    aTokenAddress: string,
    stableDebtTokenAddress: string,
    variableDebtTokenAddress: string,
    interestRateStrategyAddress: string
  ): void {
    reserve.liquidityIndex = WadRayMath.ray();
    reserve.variableBorrowIndex = WadRayMath.ray();
    reserve.aTokenAddress = aTokenAddress;
    reserve.stableDebtTokenAddress = stableDebtTokenAddress;
    reserve.variableDebtTokenAddress = variableDebtTokenAddress;
    reserve.interestRateStrategyAddress = interestRateStrategyAddress;
  }

  /**
   * @dev Updates the liquidity cumulative index and the variable borrow index.
   * @param reserve The reserve object
   **/
  async updateState(reserve: ReserveData, ecosystem: Ecosystem) {
    const variableDebtToken = await loadContract<VariableDebtToken>(
      ecosystem,
      reserve.variableDebtTokenAddress
    );

    const scaledVariableDebt = variableDebtToken.scaledTotalSupply([]);
    const previousVariableBorrowIndex = reserve.variableBorrowIndex;
    const previousLiquidityIndex = reserve.liquidityIndex;
    const lastUpdatedTimestamp = reserve.lastUpdateTimestamp;

    const [newLiquidityIndex, newVariableBorrowIndex] = reserve._updateIndexes(
      reserve,
      scaledVariableDebt,
      previousLiquidityIndex,
      previousVariableBorrowIndex,
      lastUpdatedTimestamp
    );

    reserve._mintToTreasury(
      reserve,
      scaledVariableDebt,
      previousVariableBorrowIndex,
      newLiquidityIndex,
      newVariableBorrowIndex,
      lastUpdatedTimestamp,
      ecosystem
    );
  }

  async _mintToTreasury(
    reserve: ReserveData,
    scaledVariableDebt: bigint,
    previousVariableBorrowIndex: bigint,
    newLiquidityIndex: bigint,
    newVariableBorrowIndex: bigint,
    timestamp: number,
    ecosystem: Ecosystem
  ): Promise<void> {
    const reserveFactor = reserve.configuration.getReserveFactor();

    if (reserveFactor === 0n) {
      return;
    }

    const stableDeptsToken = await loadContract<StableDebtToken>(
      ecosystem,
      reserve.stableDebtTokenAddress
    );

    const {
      totalSupply: principalStableDebt,
      calcTotalSupply: currentStableDebt,
      avgRate: avgStableRate,
      lastUpdateTimestamp: stableSupplyUpdatedTimestamp,
    } = stableDeptsToken.getSupplyData([]);

    const previousVariableDebt =
      (scaledVariableDebt * previousVariableBorrowIndex) / WadRayMath.RAY;
    const currentVariableDebt =
      (scaledVariableDebt * newVariableBorrowIndex) / WadRayMath.RAY;
    const cumulatedStableInterest =
      MathUtils.calculateCompoundedInterestWithFormula(
        avgStableRate,
        stableSupplyUpdatedTimestamp,
        timestamp
      );

    const previousStableDebt =
      (principalStableDebt * cumulatedStableInterest) / WadRayMath.RAY;
    const totalDebtAccrued =
      currentVariableDebt +
      currentStableDebt +
      previousVariableDebt -
      previousStableDebt;
    const amountToMint =
      (totalDebtAccrued * reserveFactor) /
      BigInt(PercentageMath.PERCENTAGE_FACTOR);

    if (amountToMint !== 0n) {
      const aToken = await loadContract<AToken>(
        ecosystem,
        reserve.aTokenAddress
      );
      await aToken.mintToTreasury([amountToMint, newLiquidityIndex]);
    }
  }

  private _updateIndexes(
    reserve: ReserveData,
    scaledVariableDebt: bigint,
    liquidityIndex: bigint,
    variableBorrowIndex: bigint,
    timestamp: number
  ): [bigint, bigint] {
    const currentLiquidityRate = reserve.currentLiquidityRate;

    let newLiquidityIndex = liquidityIndex;
    let newVariableBorrowIndex = variableBorrowIndex;

    // Only cumulating if there is any income being produced
    if (currentLiquidityRate > 0n) {
      const cumulatedLiquidityInterest = MathUtils.calculateLinearInterest(
        currentLiquidityRate,
        timestamp
      );

      newLiquidityIndex =
        (newLiquidityIndex * cumulatedLiquidityInterest) / BigInt(10 ** 27);

      // Check for overflow
      const maxUint128 = BigInt(2 ** 128 - 1);
      if (newLiquidityIndex > maxUint128) {
        throw new Error("Liquidity index overflow");
      }

      reserve.liquidityIndex = newLiquidityIndex;

      // Ensure that there is actual variable debt before accumulating
      if (scaledVariableDebt !== 0n) {
        const cumulatedVariableBorrowInterest =
          MathUtils.calculateCompoundedInterest(
            reserve.currentLiquidityRate,
            timestamp
          );
        newVariableBorrowIndex *= cumulatedVariableBorrowInterest;

        // Check for overflow
        if (newVariableBorrowIndex > Number.MAX_SAFE_INTEGER) {
          throw new Error("Variable borrow index overflow");
        }
        reserve.variableBorrowIndex = newVariableBorrowIndex;
      }
    }

    reserve.lastUpdateTimestamp = Date.now();
    return [newLiquidityIndex, newVariableBorrowIndex];
  }

  async updateInterestRates(
    reserveAddress: string, // Address of the reserve
    aTokenAddress: string, // Address of the aToken
    liquidityAdded: bigint, // Amount of liquidity added
    liquidityTaken: bigint, // Amount of liquidity taken
    ecosystem: Ecosystem
  ): Promise<void> {
    const vars = {
      stableDebtTokenAddress: this.stableDebtTokenAddress,
      totalStableDebt: 0n,
      avgStableRate: 0n,
      totalVariableDebt: 0n,
      newLiquidityRate: 0n,
      newStableRate: 0n,
      newVariableRate: 0n,
    };

    // Get the total stable debt and the average stable rate
    const stableDebtToken = await loadContract<StableDebtToken>(
      ecosystem,
      vars.stableDebtTokenAddress
    );

    const { calcTotalSupply: totalStableDebt, avgRate: avgStableRate } =
      await stableDebtToken.getTotalSupplyAndAvgRate([]);

    vars.totalStableDebt = totalStableDebt;
    vars.avgStableRate = avgStableRate;

    // Calculate the total variable debt using the scaled total supply
    const variableDebtToken = await loadContract<VariableDebtToken>(
      ecosystem,
      this.variableDebtTokenAddress
    );

    const scaledTotalSupply = await variableDebtToken.scaledTotalSupply([]);

    vars.totalVariableDebt = WadRayMath.rayMul(
      scaledTotalSupply,
      this.variableBorrowIndex
    );

    // Calculate the new interest rates using the strategy contract
    const interestRateStrategy =
      await loadContract<DefaultReserveInterestRateStrategy>(
        ecosystem,
        this._reserveInterestRateStrategy
      );

    const [newLiquidityRate, newStableRate, newVariableRate] =
      await interestRateStrategy.calculateInterestRates([
        reserveAddress,
        aTokenAddress,
        liquidityAdded,
        liquidityTaken,
        vars.totalStableDebt,
        vars.totalVariableDebt,
        vars.avgStableRate,
        this.configuration.getReserveFactor(),
      ]);

    // Ensure the new rates do not exceed uint128 limits
    const maxUint128 = 2n ** 128n - 1n;
    if (newLiquidityRate > maxUint128)
      throw new Error(Errors.RL_LIQUIDITY_RATE_OVERFLOW);
    if (newStableRate > maxUint128)
      throw new Error(Errors.RL_STABLE_BORROW_RATE_OVERFLOW);
    if (newVariableRate > maxUint128)
      throw new Error(Errors.RL_VARIABLE_BORROW_RATE_OVERFLOW);

    // Update the reserve rates
    this.currentLiquidityRate = newLiquidityRate;
    this.currentStableBorrowRate = newStableRate;
    this.currentVariableBorrowRate = newVariableRate;
  }
}

enum InterestRateMode {
  NONE,
  STABLE,
  VARIABLE,
}

enum EventTypes {
  INITIALIZED = "INITIALIZED",
  MINTED = "MINTED",
  BURNED = "BURNED",
  BORROWED = "BORROWED",
  TRANSFERRED = "TRANSFERRED",
  WITHDRAWN = "WITHDRAWN",
  DEPOSITED = "DEPOSITED",
  REPAID = "REPAID",
  MINTED_TO_TREASURY = "MINTED_TO_TREASURY",
  MARKET_BORROW_RATE_CHANGED = "MARKET_BORROW_RATE_CHANGED",
  RESERVE_INITIALIZED = "RESERVE_INITIALIZED",
  MINT_ATOKEN = "MINT_ATOKEN",
  LIQUIDATION = "LIQUIDATION",
  RESERVE_FACTOR_SET = "RESERVE_FACTOR_SET",
  RESERVE_COLLATERALIZATION_CONFIGURED = "RESERVE_COLLATERALIZATION_CONFIGURED",
  UPDATED = "UPDATED",
}

type CalcInterestRatesLocalVars = {
  totalDebt: bigint;
  currentVariableBorrowRate: bigint;
  currentStableBorrowRate: bigint;
  currentLiquidityRate: bigint;
  utilizationRate: bigint;
};

type InitReserveInput = {
  aTokenImpl: string;
  stableDebtTokenImpl: string;
  variableDebtTokenImpl: string;
  underlyingAssetDecimals: number;
  interestRateStrategyAddress: string;
  underlyingAsset: string;
  treasury: string;
  incentivesController: string;
  underlyingAssetName: string;
};

type MintLocalVars = {
  previousSupply: bigint;
  nextSupply: bigint;
  amountInRay: bigint;
  newStableRate: bigint;
  currentAvgStableRate: bigint;
};

// Exporting types for external use
export { InterestRateMode, EventTypes };
export type { CalcInterestRatesLocalVars, InitReserveInput, MintLocalVars };
