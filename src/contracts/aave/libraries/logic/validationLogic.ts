import { Errors } from "../helpers/errors";
import { InterestRateMode, ReserveData } from "../types/dataTypes";
import {
  GenericLogic,
  HEALTH_FACTOR_LIQUIDATION_THRESHOLD,
} from "./genericLogic";
import { UserConfiguration } from "../configuration/userConfiguration";
import { Ecosystem } from "@/contracts/types/ecosystem";
import { ExecutionError } from "@/contracts/types/execution-error";
import { Metadata } from "@/contracts/types/metadata";

export class ValidationLogic {
  /**
   * @dev Validates a deposit action
   * @param reserve The reserve object on which the user is depositing
   * @param amount The amount to be deposited
   */
  public async validateDeposit(reserve: ReserveData, amount: bigint) {
    const reserveConfig = reserve.configuration;
    if (!reserveConfig) {
      throw new ExecutionError("Reserve not found");
    }
    if (amount <= 0n) {
      throw new ExecutionError("Invalid amount");
    }
    if (!reserveConfig.getActive()) {
      throw new ExecutionError("Reserve is not active");
    }
    if (reserveConfig.getFrozen()) {
      throw new ExecutionError("Reserve is frozen");
    }
  }

  /**
   * @dev Validates a borrow action
   * @param asset The address of the asset to borrow
   * @param reserve The reserve state from which the user is borrowing
   * @param userAddress The address of the user
   * @param amount The amount to be borrowed
   * @param amountInETH The amount to be borrowed, in ETH
   * @param interestRateMode The interest rate mode at which the user is borrowing
   * @param maxStableLoanPercent The max amount of the liquidity that can be borrowed at stable rate, in percentage
   * @param reservesData The state of all the reserves
   * @param userConfig The state of the user for the specific reserve
   * @param reserves The addresses of all the active reserves
   * @param oracle The price oracle
   */
  public async validateBorrow(
    asset: string,
    reserve: ReserveData,
    userstring: string,
    amount: bigint,
    amountInPUSD: bigint,
    interestRateMode: number,
    maxStableLoanPercent: bigint,
    reservesData: Map<string, ReserveData>,
    userConfig: UserConfiguration,
    reserves: string[],
    reservesCount: number,
    oracle: string,
    ecosystem: Ecosystem
  ): Promise<void> {
    const { isActive, isFrozen, borrowingEnabled, stableRateBorrowingEnabled } =
      reserve.configuration.getFlags();

    if (!isActive) throw new Error(Errors.VL_NO_ACTIVE_RESERVE);
    if (isFrozen) throw new Error(Errors.VL_RESERVE_FROZEN);
    if (amount === 0n) throw new Error(Errors.VL_INVALID_AMOUNT);
    if (!borrowingEnabled) throw new Error(Errors.VL_BORROWING_NOT_ENABLED);

    // Validate interest rate mode
    if (
      interestRateMode !== InterestRateMode.VARIABLE &&
      interestRateMode !== InterestRateMode.STABLE
    ) {
      throw new Error(Errors.VL_INVALID_INTEREST_RATE_MODE_SELECTED);
    }

    const [
      userCollateralBalancePUSD,
      userBorrowBalancePUSD,
      currentLtv,
      currentLiquidationThreshold,
      healthFactor,
    ] = await GenericLogic.calculateUserAccountData(
      userstring,
      reservesData,
      userConfig,
      reserves,
      reservesCount,
      oracle,
      ecosystem
    );

    if (!(userCollateralBalancePUSD > 0n))
      throw new Error(Errors.VL_COLLATERAL_BALANCE_IS_0);
    if (healthFactor <= HEALTH_FACTOR_LIQUIDATION_THRESHOLD) {
      throw new Error(Errors.VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD);
    }

    // Calculate the collateral needed
    const amountOfCollateralNeededPUSD =
      userBorrowBalancePUSD + amountInPUSD / (currentLtv / 100n);

    if (amountOfCollateralNeededPUSD > userCollateralBalancePUSD) {
      throw new Error(Errors.VL_COLLATERAL_CANNOT_COVER_NEW_BORROW);
    }

    // Check stable borrow conditions
    if (
      interestRateMode === InterestRateMode.STABLE &&
      reserve.id !== undefined
    ) {
      if (!stableRateBorrowingEnabled) {
        throw new Error(Errors.VL_STABLE_BORROWING_NOT_ENABLED);
      }
      const balance = await GenericLogic.getBalance(
        reserve.aTokenAddress,
        userstring,
        ecosystem
      );

      if (
        userConfig.isUsingAsCollateral(reserve.id) ||
        reserve.configuration.getLtv() === 0n ||
        amount < balance
      ) {
        throw new Error(Errors.VL_COLLATERAL_SAME_AS_BORROWING_CURRENCY);
      }

      const availableLiquidity = await GenericLogic.getBalance(
        asset,
        reserve.aTokenAddress,
        ecosystem
      );
      const maxLoanSizeStable =
        (availableLiquidity * maxStableLoanPercent) / 100n;

      if (amount >= maxLoanSizeStable) {
        throw new Error(Errors.VL_AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE);
      }
    }
  }

  /**
   * @dev Validates a repay action
   * @param reserve The reserve state from which the user is repaying
   * @param amountSent The amount sent for the repayment. Can be an actual value or uint(-1)
   * @param onBehalfOf The address of the user msg.sender is repaying for
   * @param stableDebt The borrow balance of the user
   * @param variableDebt The borrow balance of the user
   */
  public async validateRepay({
    reserve,
    amountSent,
    rateMode,
    onBehalfOf,
    stableDebt,
    variableDebt,
    metadata,
  }: {
    reserve: ReserveData;
    amountSent: bigint;
    rateMode: InterestRateMode;
    onBehalfOf: string;
    stableDebt: bigint;
    variableDebt: bigint;
    metadata: Metadata;
  }) {
    const isActive = await reserve.configuration.getActive();

    if (!isActive) {
      throw new ExecutionError("Reserve is not active");
    }

    if (amountSent <= 0n) {
      throw new ExecutionError("Invalid amount for repayment");
    }

    const hasDebt =
      (stableDebt > 0n && rateMode === InterestRateMode.STABLE) ||
      (variableDebt > 0n && rateMode === InterestRateMode.VARIABLE);

    if (!hasDebt) {
      throw new ExecutionError("No debt of the selected type");
    }

    if (amountSent === BigInt(-1) && metadata.sender !== onBehalfOf) {
      throw new ExecutionError(
        "Cannot repay on behalf without explicit amount"
      );
    }
  }

  /**
   * @dev Validates a withdraw action.
   * @param reservestring The address of the reserve.
   * @param amount The amount to be withdrawn.
   * @param userBalance The balance of the user.
   * @param reservesData The reserves state.
   * @param userConfig The user configuration.
   * @param reserves The addresses of the reserves.
   * @param reservesCount The number of reserves.
   * @param oracle The price oracle.
   */
  async validateWithdraw(
    reservestring: string,
    amount: bigint,
    userBalance: bigint,
    reserves: Map<string, ReserveData>,
    userConfig: UserConfiguration,
    reservesList: string[],
    reservesCount: number,
    oracle: string,
    ecosystem: Ecosystem,
    metadat: Metadata
  ): Promise<void> {
    if (amount === 0n) throw new Error("Invalid amount");
    if (amount > userBalance)
      throw new Error("Not enough available user balance");
    const reserve = reserves.get(reservestring);
    if (!reserve) throw new Error("Reserve not found");
    const { isActive } = reserve.configuration.getFlags();
    if (!isActive) throw new Error("No active reserve");

    const isAllowed = await GenericLogic.balanceDecreaseAllowed(
      reservestring,
      metadat.sender,
      amount,
      reserves,
      userConfig,
      reservesList,
      reservesCount,
      oracle,
      ecosystem
    );

    if (!isAllowed) throw new Error("Transfer not allowed");
  }
}
