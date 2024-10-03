import { Contract, ContractParams } from "./types/contract";
import { zUtils } from "./utils/zod";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing";
import { ExecutionError } from "./types/execution-error";
import { LRC20Base } from "./standards/base/LRC20Base";
import { Ecosystem } from "./types/ecosystem";
import { UserConfiguration } from "./aave/libraries/configuration/userConfiguration";
import { ReserveConfiguration } from "./aave/libraries/configuration/reserveConfiguration";
import { ValidationLogic } from "./aave/libraries/logic/validationLogic";
import { ReserveLogic } from "./aave/libraries/logic/reserveLogic";
import { Errors } from "./aave/libraries/helpers/errors";
import { reserveConfigSchema } from "./aave/libraries/types/zod";
import { loadContract } from "@/lib/utils";
import {
  EventTypes,
  InterestRateMode,
  ReserveData,
} from "./aave/libraries/types/dataTypes";
import { Helpers } from "./aave/libraries/helpers/helpers";
import Oracle from "./oracle";
import StableDebtToken from "./stableDebtToken";
import VariableDebtToken from "./variableDebtToken";
import AToken from "./aToken";

export default class LendingPool implements Contract {
  activeOn = 100;
  private _totalBalances = new Map<string, bigint>();
  private _borrowedBalances = new Map<string, Map<string, bigint>>();
  private _collateralBalances = new Map<string, bigint>();
  private _collateralFactor = 1.5;
  private _healthFactor = new Map<string, bigint>();
  private _lendingPoolConfigurator: string = "lendingPoolConfigurator";
  private _reserves = new Map<string, ReserveData>();
  private _reservesCount: number = 0;
  private _reservesList: string[] = [];
  private _usersConfig = new Map<string, UserConfiguration>();
  private _validationLogic = new ValidationLogic();
  private _reserveLogic = new ReserveLogic();
  private _maxStableRateBorrowSizePercent = 2500n;
  private _flashLoanPremiumTotal = 9;
  private _maxNumberOfReserves = 128;
  private _priceOracle = "oracle";

  private _onlyLendingPoolConfigurator(sender: string) {
    if (sender !== this._lendingPoolConfigurator) {
      throw new Error("Only LendingPoolConfigurator can call this function");
    }
  }

  /**
   * @dev Sets the configuration bitmap of the reserve as a whole
   * - Only callable by the LendingPoolConfigurator contract
   * @param asset The address of the underlying asset of the reserve
   * @param configuration The new configuration bitmap
   **/
  async setConfiguration({ metadata, args }: ContractParams) {
    this._onlyLendingPoolConfigurator(metadata.sender);

    const schema = z.tuple([z.string(), reserveConfigSchema]);
    const [asset, configruation] = argsParsing(
      schema,
      args,
      "setConfiguration"
    );

    const reserve = this._reserves.get(asset);

    if (!reserve) {
      throw new Error("Reserve not found");
    }
    reserve.configuration.setConfiguration(configruation);
  }

  /**
   * @dev Retrieves the configuration of a specified reserve asset.
   * @param args The parameters containing the asset information.
   * @return The configuration of the specified reserve as a ReserveConfiguration object.
   * @throws Error if the reserve for the specified asset is not found.
   */
  getConfiguration({ args }: ContractParams): ReserveConfiguration {
    const schema = z.tuple([z.string()]);
    const [asset] = argsParsing(schema, args, "getConfiguration");
    const reserve = this._reserves.get(asset);

    if (!reserve) {
      throw new Error(`Reserve with asset ${asset} not found`);
    }

    return reserve.configuration;
  }

  /**
   * @dev Returns the state and configuration of the reserve
   * @param asset The address of the underlying asset of the reserve
   * @return The state of the reserve
   **/
  getReserveData({ args }: ContractParams): ReserveData {
    const schema = z.tuple([z.string()]);
    const [asset] = argsParsing(schema, args, "getConfiguration");
    const reserve = this._reserves.get(asset);

    if (!reserve) {
      throw new Error(`Reserve with asset ${asset} not found`);
    }

    return reserve;
  }

  /**
   * Get the balance of a user
   * @param args - Arguments for the contract
   */
  balance({ args }: ContractParams): Map<string, bigint> {
    const schema = z.tuple([z.string()]);
    const [user] = argsParsing(schema, args, "balance");
    return new Map([[user, this._collateralBalances.get(user) ?? 0n]]);
  }

  /**
   * Get the total balance of a token
   * @param args - Arguments for the contract
   */
  totalBalance({ args }: ContractParams): Map<string, bigint> {
    const schema = z.tuple([z.string()]);
    const [token] = argsParsing(schema, args, "totalBalance");
    return new Map([[token, this._totalBalances.get(token) ?? 0n]]);
  }

  /**
   * @dev Returns the normalized variable debt per unit of asset
   * @param asset The address (or unique identifier) of the underlying asset of the reserve
   * @return The reserve normalized variable debt
   */
  getReserveNormalizedVariableDebt({ args }: ContractParams): bigint {
    const schema = z.tuple([z.string()]);
    const [asset] = argsParsing(
      schema,
      args,
      "getReserveNormalizedVariableDebt"
    );
    const reserve = this._reserves.get(asset);
    if (!reserve) {
      throw new Error(`Reserve for asset ${asset} not found`);
    }
    return this._reserveLogic.getNormalizedDebt(reserve);
  }

  /**
   * @dev Retrieves the user's account data, including collateral balances, borrowed balances, and health factor.
   *
   * This function takes a user address as input and returns an object containing:
   * - totalCollateralETH: The total collateral balance of the user in ETH.
   * - totalBorrowsETH: The total borrowed balance of the user in ETH (as a Map).
   * - availableBorrowsETH: The amount that can be borrowed by the user (currently set to 0n).
   * - currentLiquidationThreshold: The threshold for liquidation (currently set to 0n).
   * - ltv: Loan-to-value ratio (currently set to 0n).
   * - healthFactor: The user's health factor, indicating their account's risk level.
   *
   * @param args - The function parameters containing the user address.
   * @returns An object with the user's account data.
   */
  getUserAccountData({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [user] = argsParsing(schema, args, "getUserAccountData");

    const collateralBalance = this._collateralBalances.get(user) ?? 0n;
    const borrowedBalance =
      this._borrowedBalances.get(user) ?? new Map<string, bigint>();

    return {
      totalCollateralETH: collateralBalance,
      totalBorrowsETH: borrowedBalance,
      availableBorrowsETH: 0n,
      currentLiquidationThreshold: 0n,
      ltv: 0n,
      healthFactor: this._healthFactor.get(user) ?? 0n,
    };
  }

  /**
   * @dev Initializes a reserve, activating it, assigning an aToken and debt tokens and an
   * interest rate strategy
   * - Only callable by the LendingPoolConfigurator contract
   * @param asset The address of the underlying asset of the reserve
   * @param aTokenAddress The address of the aToken that will be assigned to the reserve
   * @param stableDebtAddress The address of the StableDebtToken that will be assigned to the reserve
   * @param variableDebtAddress The address of the VariableDebtToken that will be assigned to the reserve
   * @param interestRateStrategyAddress The address of the interest rate strategy contract
   */
  public async initReserve({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams) {
    this._onlyLendingPoolConfigurator(metadata.sender);
    const schema = z.tuple([
      z.string(),
      z.string(),
      z.string(),
      z.string(),
      z.string(),
    ]);
    const [
      asset,
      aTokenAddress,
      stableDebtAddress,
      variableDebtAddress,
      interestRateStrategyAddress,
    ] = argsParsing(schema, args, "initReserve");

    let reserve = this._reserves.get(asset);

    if (!reserve) {
      this._reserves.set(asset, new ReserveData());
      reserve = this._reserves.get(asset);
    }

    if (!reserve) {
      throw new Error("Failed to initialize reserve");
    }

    // Initialize the reserve
    reserve.initReserveData(
      reserve,
      aTokenAddress,
      stableDebtAddress,
      variableDebtAddress,
      interestRateStrategyAddress
    );

    this._addReserveToList(asset);

    eventLogger.log({
      type: EventTypes.RESERVE_INITIALIZED,
      message: `Initialized reserve for asset: ${asset}, aToken: ${aTokenAddress}, stableDebtToken: ${stableDebtAddress}, variableDebtToken: ${variableDebtAddress}, interestRateStrategy: ${interestRateStrategyAddress}`,
    });
  }

  /**
   * deposit tokens to the lending pool, gives aTokens in return
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @param eventLogger - Event logger
   * @param ecosystem - Ecosystem
   */
  async deposit({ metadata, args, eventLogger, ecosystem }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint(), z.string()]);
    const [token, amount, onBehalfOf] = argsParsing(schema, args, "deposit");

    const reserve = this._reserves.get(token);

    if (!reserve) {
      throw new ExecutionError("Reserve not found");
    }

    await this._validationLogic.validateDeposit(reserve, amount);

    await reserve.updateState(reserve, ecosystem);

    await reserve.updateInterestRates(
      token,
      reserve.aTokenAddress,
      amount,
      0n,
      ecosystem
    );

    const aToken = await loadContract<AToken>(ecosystem, reserve.aTokenAddress);

    const Token = await loadContract<LRC20Base>(ecosystem, token);

    await Token.transferFrom([metadata.sender, reserve.aTokenAddress, amount]);

    const totalBalance = this._totalBalances.get(token) ?? 0n;
    this._totalBalances.set(token, totalBalance + amount);

    const isFirstDeposit = await aToken.mintAToken([
      onBehalfOf,
      amount,
      reserve.liquidityIndex,
    ]);

    if (isFirstDeposit && reserve.id !== undefined) {
      let userConfig = this._usersConfig.get(onBehalfOf);

      if (!userConfig) {
        userConfig = new UserConfiguration();
        this._usersConfig.set(onBehalfOf, userConfig);
      }
      userConfig.setUsingAsCollateral(reserve.id, true);
    }

    eventLogger.log({
      type: EventTypes.DEPOSITED,
      message: `${metadata.sender} deposited ${amount} ${token} on behalf of ${onBehalfOf}`,
    });

    eventLogger.log({
      type: EventTypes.MINT_ATOKEN,
      message: `Minted ${amount} a${token} for ${onBehalfOf}`,
    });
  }

  /**
   * Borrow tokens from the lending pool, requires collateral
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @param eventLogger - Event logger
   * @param ecosystem - Ecosystem, contains all the contracts
   */
  async borrow({ metadata, args, eventLogger, ecosystem }: ContractParams) {
    const schema = z.tuple([
      z.string(), // asset
      zUtils.bigint(), // amount
      z.number(), // interestRateMode (e.g. stable or variable)
      z.string(), // onBehalfOf
    ]);

    const [asset, amount, interestRateMode, onBehalfOf] = argsParsing(
      schema,
      args,
      "borrow"
    );
    const reserve = this._reserves.get(asset);

    if (!reserve) {
      throw new ExecutionError("Reserve not found");
    }

    // Execute borrow logic
    await this._executeBorrow({
      asset,
      user: metadata.sender,
      onBehalfOf,
      amount,
      interestRateMode,
      aTokenAddress: reserve.aTokenAddress,
      releaseUnderlying: true,
      ecosystem,
    });

    eventLogger.log({
      type: EventTypes.BORROWED,
      message: `${onBehalfOf} borrowed ${amount} ${asset} for ${metadata.sender}`,
    });
  }

  async _executeBorrow({
    asset,
    user,
    onBehalfOf,
    amount,
    interestRateMode,
    aTokenAddress,
    releaseUnderlying,
    ecosystem,
  }: {
    asset: string;
    user: string;
    onBehalfOf: string;
    amount: bigint;
    interestRateMode: number;
    aTokenAddress: string;
    releaseUnderlying: boolean;
    ecosystem: Ecosystem;
  }) {
    const reserve = this._reserves.get(asset);
    if (!reserve) throw new ExecutionError("Reserve not found");

    const userConfig = this._usersConfig.get(onBehalfOf);

    if (!userConfig) {
      throw new ExecutionError("User config not found");
    }

    const oracleInctance = await loadContract<Oracle>(
      ecosystem,
      this._priceOracle
    );

    const assetPrice = await oracleInctance.getAssetPrice([asset]);

    if (!assetPrice) {
      throw new ExecutionError("Oracle asset price not found");
    }

    const amountInPUSD =
      (assetPrice * amount) /
      10n ** BigInt(reserve.configuration.getDecimals());

    // Validate borrow request
    await this._validationLogic.validateBorrow(
      asset,
      reserve,
      onBehalfOf,
      amount,
      amountInPUSD,
      interestRateMode,
      this._maxStableRateBorrowSizePercent,
      this._reserves,
      userConfig,
      Array.from(this._reserves.keys()),
      Array.from(this._reserves.keys()).length,
      this._priceOracle,
      ecosystem
    );

    // Update reserve state before minting
    await reserve.updateState(reserve, ecosystem);

    let isFirstBorrowing = false;
    let currentRate = 0n;

    // Determine if stable or variable rate
    if (interestRateMode === 1) {
      // STABLE
      currentRate = reserve.currentStableBorrowRate;
      const stableDebtTokenInctance = await loadContract<StableDebtToken>(
        ecosystem,
        reserve.stableDebtTokenAddress
      );

      isFirstBorrowing = await stableDebtTokenInctance.mintStableDeptToken([
        user,
        onBehalfOf,
        amount,
        currentRate,
      ]);
    } else {
      const variableDebtToken = await loadContract<VariableDebtToken>(
        ecosystem,
        reserve.stableDebtTokenAddress
      );

      isFirstBorrowing = await variableDebtToken.mintVariableDeptToken([
        user,
        onBehalfOf,
        amount,
        reserve.variableBorrowIndex,
      ]);
    }

    if (isFirstBorrowing && reserve.id !== undefined) {
      userConfig.setBorrowing(reserve.id, true);
    }

    // Update interest rates
    await reserve.updateInterestRates(
      asset,
      aTokenAddress,
      0n,
      releaseUnderlying ? amount : 0n,
      ecosystem
    );

    if (releaseUnderlying) {
      const aToken = await loadContract<AToken>(ecosystem, aTokenAddress);
      await aToken.transferUnderlyingTo([user, amount]);
    }
  }

  /**
   * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
   * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
   * @param asset The address of the underlying asset to withdraw
   * @param amount The underlying amount to be withdrawn
   *   - Send the value type(uint256).max in order to withdraw the whole aToken balance
   * @param to Address that will receive the underlying, same as msg.sender if the user
   *   wants to receive it on his own wallet, or a different address if the beneficiary is a
   *   different wallet
   * @return The final amount withdrawn
   **/
  public async withdraw({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<bigint> {
    const schema = z.tuple([z.string(), zUtils.bigint(), z.string()]);
    const [asset, amount, to] = argsParsing(schema, args, "withdraw");

    const reserve = this._reserves.get(asset);
    if (!reserve) throw new Error("Reserve not found");

    const aTokenInctance = await loadContract<AToken>(
      ecosystem,
      reserve.aTokenAddress
    );
    const userBalance = aTokenInctance.balanceOf([to]);

    let amountToWithdraw = amount;

    if (amount === BigInt(Number.MAX_SAFE_INTEGER)) {
      amountToWithdraw = userBalance;
    }

    await this._validationLogic.validateWithdraw(
      asset,
      amountToWithdraw,
      userBalance,
      this._reserves,
      this._usersConfig.get(to)!,
      Array.from(this._reserves.keys()),
      this._reserves.size,
      this._priceOracle,
      ecosystem,
      metadata
    );

    reserve.updateState(reserve, ecosystem);
    reserve.updateInterestRates(
      asset,
      reserve.aTokenAddress,
      0n,
      amountToWithdraw,
      ecosystem
    );

    if (amountToWithdraw === userBalance && reserve.id !== undefined) {
      this._usersConfig.get(to)!.setUsingAsCollateral(reserve.id, false);
    }

    await aTokenInctance.burn([
      to,
      to,
      amountToWithdraw,
      reserve.liquidityIndex,
    ]);

    eventLogger.log({
      type: EventTypes.WITHDRAWN,
      message: `Withdrawn ${amountToWithdraw} of ${asset} to ${to}.`,
    });
    return amountToWithdraw;
  }

  /**
   * @notice Repays a borrowed `amount` on a specific reserve, burning the equivalent debt tokens owned
   * - E.g. User repays 100 USDC, burning 100 variable/stable debt tokens of the `onBehalfOf` address
   * @param asset The address of the borrowed underlying asset previously borrowed
   * @param amount The amount to repay
   * - Send the value type(uint256).max in order to repay the whole debt for `asset` on the specific `debtMode`
   * @param rateMode The interest rate mode at of the debt the user wants to repay: 1 for Stable, 2 for Variable
   * @param onBehalfOf Address of the user who will get his debt reduced/removed. Should be the address of the
   * user calling the function if he wants to reduce/remove his own debt, or the address of any other
   * other borrower whose debt should be removed
   * @return The final amount repaid
   **/
  async repay({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<bigint> {
    const schema = z.tuple([
      z.string(),
      zUtils.bigint(),
      z.number(),
      z.string(),
    ]);
    const [asset, amount, rateMode, onBehalfOf] = argsParsing(
      schema,
      args,
      "repay"
    );

    const reserve = this._reserves.get(asset);
    if (!reserve) {
      throw new ExecutionError("Reserve not found");
    }

    const userConfig = this._usersConfig.get(onBehalfOf);
    if (!userConfig) {
      throw new ExecutionError("User config not found");
    }

    const [stableDebt, variableDebt] = await Helpers.getUserCurrentDebt(
      onBehalfOf,
      reserve,
      ecosystem
    );

    const interestRateMode =
      rateMode === 1 ? InterestRateMode.STABLE : InterestRateMode.VARIABLE;

    // Validate the repayment
    await this._validationLogic.validateRepay({
      reserve,
      amountSent: amount,
      rateMode: interestRateMode,
      onBehalfOf,
      stableDebt,
      variableDebt,
      metadata,
    });

    // Determine the actual amount to repay
    let paybackAmount =
      interestRateMode === InterestRateMode.STABLE ? stableDebt : variableDebt;

    if (amount < paybackAmount) {
      paybackAmount = amount;
    }

    await reserve.updateState(reserve, ecosystem);

    if (interestRateMode === InterestRateMode.STABLE) {
      const stableDebtToken = await loadContract<StableDebtToken>(
        ecosystem,
        reserve.stableDebtTokenAddress
      );
      await stableDebtToken.burn([onBehalfOf, paybackAmount]);
    } else {
      const variableDebtToken = await loadContract<VariableDebtToken>(
        ecosystem,
        reserve.variableDebtTokenAddress
      );
      await variableDebtToken.burn([
        onBehalfOf,
        paybackAmount,
        reserve.variableBorrowIndex,
      ]);
    }

    await reserve.updateInterestRates(
      asset,
      reserve.aTokenAddress,
      paybackAmount,
      0n,
      ecosystem
    );

    // Check if the user's total debt is cleared and update user config
    if (
      stableDebt + variableDebt - BigInt(paybackAmount) === 0n &&
      reserve.id !== undefined
    ) {
      userConfig.setBorrowing(reserve.id, false);
    }

    // Transfer the repayment amount from the user to the aToken
    const assetToken = await loadContract<LRC20Base>(ecosystem, asset);
    await assetToken.transferFrom([
      metadata.sender,
      reserve.aTokenAddress,
      paybackAmount,
    ]);

    // Handle repayment in the aToken contract
    const aTokenContract = await loadContract<AToken>(
      ecosystem,
      reserve.aTokenAddress
    );
    aTokenContract.handleRepayment([metadata.sender, paybackAmount]);

    eventLogger.log({
      type: "REPAY",
      message: `${onBehalfOf} repaid ${paybackAmount} ${asset} for ${metadata.sender}`,
    });

    return paybackAmount;
  }

  /**
   * @dev Executes the liquidation of a user's collateral when they have insufficient funds to cover their debt.
   *
   * This function performs the following steps:
   * - Parses the input arguments, which include:
   *   - collateralAsset: The address of the collateral asset.
   *   - debtAsset: The address of the debt asset.
   *   - user: The address of the user being liquidated.
   *   - debtToCover: The amount of debt to be covered in the liquidation.
   *   - receiveAToken: A boolean indicating whether to receive aTokens as a result of the liquidation.
   *
   * - Checks if the user has sufficient borrowed tokens to cover the debt to be liquidated.
   * - Calculates the required collateral based on the collateral factor and the debt to cover.
   * - Validates that the user has enough collateral to support the liquidation.
   * - Loads the token contracts for the debt and collateral assets from the ecosystem.
   * - Transfers the specified amount of debt tokens from the user to the liquidator (metadata.sender).
   * - Transfers the required amount of collateral from the user to the liquidator.
   * - Updates the user's borrowed and collateral balances in the state.
   * - Logs the liquidation event with details of the transaction.
   *
   * @param metadata - The metadata containing information about the transaction sender.
   * @param args - The function parameters containing the necessary details for the liquidation.
   * @param eventLogger - The event logger for recording the liquidation event.
   * @param ecosystem - The ecosystem containing the token contracts.
   */
  async liquidationCall({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams) {
    const schema = z.tuple([
      z.string(),
      z.string(),
      z.string(),
      zUtils.bigint(),
      z.boolean(),
    ]);
    const [collateralAsset, debtAsset, user, debtToCover, receiveAToken] =
      argsParsing(schema, args, "liquidationCall");

    const collateralBalance = this._collateralBalances.get(user) ?? 0n;
    const borrowedBalance =
      this._borrowedBalances.get(user) ?? new Map<string, bigint>();
    const borrowedTokenBalance = borrowedBalance.get(debtAsset) ?? 0n;

    if (borrowedTokenBalance < debtToCover) {
      throw new ExecutionError("liquidationCall: not enough borrowed tokens");
    }

    const collateralFactor = this._collateralFactor;
    const requiredCollateral =
      (BigInt(collateralFactor * 100) * debtToCover) / 100n;

    if (collateralBalance < requiredCollateral) {
      throw new ExecutionError("liquidationCall: not enough collateral");
    }

    const token = await loadContract<LRC20Base>(ecosystem, debtAsset);
    const collateralAssetToken = await loadContract<LRC20Base>(
      ecosystem,
      collateralAsset
    );

    token.transfer([metadata.sender, debtToCover]);
    collateralAssetToken.transfer([user, requiredCollateral]);

    borrowedBalance.set(debtAsset, borrowedTokenBalance - debtToCover);
    this._borrowedBalances.set(user, borrowedBalance);

    this._collateralBalances.set(user, collateralBalance - requiredCollateral);

    eventLogger.log({
      type: EventTypes.LIQUIDATION,
      message: `${metadata.sender} liquidated ${debtToCover} ${debtAsset} for ${user}`,
    });
  }

  /**
   * @dev Adds a reserve asset to the internal reserves list.
   *
   * This function performs the following checks and actions:
   * - Verifies if the current number of reserves has reached the maximum limit.
   *   If so, it throws an error indicating no more reserves are allowed.
   * - Retrieves the reserve associated with the specified asset from the reserves map.
   * - If the reserve does not exist, the function returns early.
   * - Checks if the reserve has already been added by verifying its ID
   *   or if it is the first asset in the reserves list.
   * - If the reserve has not been added yet:
   *   - Assigns a unique ID to the reserve based on the current reserves count.
   *   - Adds the asset to the reserves list at the current reserves count index.
   *   - Increments the reserves count by one.
   *
   * @param asset - The address of the reserve asset to be added.
   */
  private _addReserveToList(asset: string): void {
    const reservesCount = this._reservesCount;

    if (reservesCount >= this._maxNumberOfReserves) {
      throw new Error(Errors.LP_NO_MORE_RESERVES_ALLOWED);
    }
    const reserve = this._reserves.get(asset);
    if (!reserve) {
      return;
    }

    const reserveAlreadyAdded =
      reserve.id !== undefined || this._reservesList[0] === asset;

    if (!reserveAlreadyAdded) {
      reserve.id = reservesCount;
      this._reservesList[reservesCount] = asset;

      this._reservesCount++;
    }
  }
}
