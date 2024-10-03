import { UserConfiguration } from "../configuration/userConfiguration";
import { Ecosystem } from "@/contracts/types/ecosystem";
import { MAX_UINT256 } from "../math/mathUtils";
import { ReserveData } from "../types/dataTypes";
import { loadContract } from "@/lib/utils";
import AToken from "@/contracts/aToken";
import Oracle from "@/contracts/oracle";

// Constants
export const HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 100000000n; // 1 PUSD

// Utility functions for math (adapt WadRayMath, SafeMath, PercentageMath)
class MathUtils {
  static wadDiv(a: bigint, b: bigint): bigint {
    return a / b;
  }

  static percentMul(a: bigint, b: bigint): bigint {
    return (a * b) / 10000n; // 100% is 10000 basis points
  }

  static mulDiv(a: bigint, b: bigint, div: bigint): bigint {
    return (a * b) / div;
  }
}

// Main GenericLogic class
export class GenericLogic {
  /**
   * @dev Checks if a specific balance decrease is allowed
   * (i.e. doesn't bring the user borrow position health factor under HEALTH_FACTOR_LIQUIDATION_THRESHOLD)
   * @param asset The address of the underlying asset of the reserve
   * @param user The address of the user
   * @param amount The amount to decrease
   * @param reservesData The data of all the reserves
   * @param userConfig The user configuration
   * @param reserves The list of all the active reserves
   * @param oracle The address of the oracle contract
   * @return true if the decrease of the balance is allowed
   **/
  static async balanceDecreaseAllowed(
    asset: string,
    user: string,
    amount: bigint,
    reservesData: Map<string, ReserveData>,
    userConfig: UserConfiguration,
    reserves: string[],
    reservesCount: number,
    oracle: string,
    ecosystem: Ecosystem
  ): Promise<boolean> {
    // Check if user is borrowing any assets or using the asset as collateral
    if (
      !userConfig.isBorrowingAny() ||
      !userConfig.isUsingAsCollateral(reservesData.get(asset)!.id!)
    ) {
      return true;
    }

    const vars: {
      liquidationThreshold: bigint;
      decimals: number;
      totalCollateralInPUSD: bigint;
      totalDebtInPUSD: bigint;
      avgLiquidationThreshold: bigint;
      amountToDecreaseInPUSD: bigint;
      collateralBalanceAfterDecrease: bigint;
      liquidationThresholdAfterDecrease: bigint;
    } = {
      liquidationThreshold: 0n,
      decimals: 0,
      totalCollateralInPUSD: 0n,
      totalDebtInPUSD: 0n,
      avgLiquidationThreshold: 0n,
      amountToDecreaseInPUSD: 0n,
      collateralBalanceAfterDecrease: 0n,
      liquidationThresholdAfterDecrease: 0n,
    };

    // Retrieve liquidation threshold and decimals from reserve parameters
    const { liquidationThreshold, decimals } = reservesData
      .get(asset)!
      .configuration.getParams();

    vars.liquidationThreshold = liquidationThreshold;
    vars.decimals = decimals;
    // If liquidation threshold is zero, allow the decrease
    if (vars.liquidationThreshold === 0n) {
      return true;
    }

    // Calculate user account data
    [
      vars.totalCollateralInPUSD,
      vars.totalDebtInPUSD,
      ,
      vars.avgLiquidationThreshold,
    ] = await GenericLogic.calculateUserAccountData(
      user,
      reservesData,
      userConfig,
      reserves,
      reservesCount,
      oracle,
      ecosystem
    );

    // If there is no debt, allow the decrease
    if (vars.totalDebtInPUSD === 0n) {
      return true;
    }

    const oracleInctance = await loadContract<Oracle>(ecosystem, oracle);
    const assetPrice = await oracleInctance.getAssetPrice([asset]);
    // Calculate amount to decrease in PUSD
    vars.amountToDecreaseInPUSD =
      (assetPrice * amount) / 10n ** BigInt(vars.decimals);

    // Calculate collateral balance after decrease
    vars.collateralBalanceAfterDecrease =
      vars.totalCollateralInPUSD - vars.amountToDecreaseInPUSD;

    // If collateral balance would be zero, do not allow the decrease
    if (vars.collateralBalanceAfterDecrease === 0n) {
      return false;
    }

    // Calculate liquidation threshold after decrease
    vars.liquidationThresholdAfterDecrease =
      (vars.totalCollateralInPUSD * vars.avgLiquidationThreshold -
        vars.amountToDecreaseInPUSD * vars.liquidationThreshold) /
      vars.collateralBalanceAfterDecrease;

    // Calculate health factor after decrease
    const healthFactorAfterDecrease =
      GenericLogic.calculateHealthFactorFromBalances(
        vars.collateralBalanceAfterDecrease,
        vars.totalDebtInPUSD,
        vars.liquidationThresholdAfterDecrease
      );

    // Return whether the health factor is above the threshold
    return healthFactorAfterDecrease >= HEALTH_FACTOR_LIQUIDATION_THRESHOLD;
  }

  /**
   * @dev Calculates the user data across the reserves.
   * this includes the total liquidity/collateral/borrow balances in ETH,
   * the average Loan To Value, the average Liquidation Ratio, and the Health factor.
   * @param user The address of the user
   * @param reservesData Data of all the reserves
   * @param userConfig The configuration of the user
   * @param reserves The list of the available reserves
   * @param oracle The price oracle address
   * @return The total collateral and total debt of the user in ETH, the avg ltv, liquidation threshold and the HF
   **/
  static async calculateUserAccountData(
    user: string,
    reservesData: Map<string, ReserveData>,
    userConfig: UserConfiguration,
    reserves: string[],
    reservesCount: number,
    oracle: string,
    ecosystem: Ecosystem
  ): Promise<[bigint, bigint, bigint, bigint, bigint]> {
    let totalCollateralInPUSD = 0n;
    let totalDebtInPUSD = 0n;
    let avgLtv = 0n;
    let avgLiquidationThreshold = 0n;
    let isBorrowing = false;

    if (userConfig.isEmpty()) {
      return [0n, 0n, 0n, 0n, -1n];
    }

    for (let i = 0; i < reservesCount; i++) {
      if (!userConfig.isUsingAsCollateralOrBorrowing(i)) {
        continue;
      }

      const currentReserveAddress = reserves[i];
      const currentReserve = reservesData.get(currentReserveAddress);

      if (!currentReserve) continue;

      const { ltv, liquidationThreshold, decimals } =
        currentReserve.configuration.getParams();
      const tokenUnit = 10n ** BigInt(decimals);
      const oracleInctance = await loadContract<Oracle>(ecosystem, oracle);
      const reserveUnitPrice = await oracleInctance.getAssetPrice([
        currentReserveAddress,
      ]);
      if (liquidationThreshold > 0n && userConfig.isUsingAsCollateral(i)) {
        const compoundedLiquidityBalance = await this.getBalance(
          currentReserve.aTokenAddress,
          user,
          ecosystem
        );
        const liquidityBalancePUSD =
          (reserveUnitPrice * compoundedLiquidityBalance) / tokenUnit;

        totalCollateralInPUSD = totalCollateralInPUSD + liquidityBalancePUSD;
        avgLtv = avgLtv + liquidityBalancePUSD * ltv;
        avgLiquidationThreshold =
          avgLiquidationThreshold + liquidityBalancePUSD * liquidationThreshold;
      }
      if (userConfig.isBorrowing(i)) {
        isBorrowing = true;
        let compoundedBorrowBalance = await this.getBalance(
          currentReserve.stableDebtTokenAddress,
          user,
          ecosystem
        );
        compoundedBorrowBalance =
          compoundedBorrowBalance +
          (await this.getBalance(
            currentReserve.variableDebtTokenAddress,
            user,
            ecosystem
          ));

        totalDebtInPUSD =
          totalDebtInPUSD +
          (reserveUnitPrice * compoundedBorrowBalance) / tokenUnit;
      }
    }

    avgLtv = totalCollateralInPUSD > 0n ? avgLtv / totalCollateralInPUSD : 0n;
    avgLiquidationThreshold =
      totalCollateralInPUSD > 0n
        ? avgLiquidationThreshold / totalCollateralInPUSD
        : 0n;

    const healthFactor = this.calculateHealthFactorFromBalances(
      totalCollateralInPUSD,
      totalDebtInPUSD,
      avgLiquidationThreshold
    );

    return [
      totalCollateralInPUSD,
      totalDebtInPUSD,
      avgLtv,
      avgLiquidationThreshold,
      isBorrowing ? healthFactor : MAX_UINT256,
    ];
  }

  static calculateHealthFactorFromBalances(
    totalCollateralInPUSD: bigint,
    totalDebtInPUSD: bigint,
    liquidationThreshold: bigint
  ): bigint {
    if (totalDebtInPUSD === 0n) return -1n;
    return MathUtils.wadDiv(
      totalCollateralInPUSD * liquidationThreshold,
      totalDebtInPUSD
    );
  }

  static async getBalance(
    tokenAddress: string,
    user: string,
    ecosystem: Ecosystem
  ): Promise<bigint> {
    const tokenContract = await loadContract<AToken>(ecosystem, tokenAddress);

    const balance = await tokenContract.balanceOf([user]);

    return balance ?? 0n;
  }

  static calculateAvailableBorrowsPUSD(
    totalCollateralInPUSD: bigint,
    totalDebtInPUSD: bigint,
    ltv: bigint
  ): bigint {
    let availableBorrowsPUSD = MathUtils.percentMul(totalCollateralInPUSD, ltv);

    if (availableBorrowsPUSD < totalDebtInPUSD) {
      return 0n;
    }

    availableBorrowsPUSD = availableBorrowsPUSD - totalDebtInPUSD;
    return availableBorrowsPUSD;
  }
}
