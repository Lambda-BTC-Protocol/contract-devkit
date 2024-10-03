import { z } from "zod";
import { Contract, ContractParams } from "./types/contract";
import { argsParsing } from "./utils/args-parsing";
import { zUtils } from "./utils/zod";
import { InitReserveInputSchema } from "./aave/libraries/types/zod";
import {
  getATokenName,
  getRedeployedContractName,
  getStableDebtTokenName,
  getVariableDebtTokenName,
} from "./utils/token-manager";
import { Ecosystem } from "./types/ecosystem";
import { Errors } from "./aave/libraries/helpers/errors";
import { PercentageMath } from "./aave/libraries/math/percentageMath";
import { LRC20Base } from "./standards/base/LRC20Base";
import { EventTypes, InitReserveInput } from "./aave/libraries/types/dataTypes";
import { loadContract } from "@/lib/utils";
import { EventLogger } from "./types/event-logger";
import StableDebtToken from "./stableDebtToken";
import VariableDebtToken from "./variableDebtToken";
import LendingPool from "./lendingPool";
import AToken from "./aToken";

export default class LendingPoolConfigurator implements Contract {
  activeOn: number = 100;
  private _pool: string;
  private _owner: string = "walletA";
  private _treasury: string = "walletB";

  constructor() {
    this._pool = "lendingPool";
  }

  private _onlyOwner(sender: string) {
    if (sender !== this._owner) {
      throw new Error("Only Owner can call this function");
    }
  }

  /**
   * @dev Updates the reserve factor of a reserve
   * @param asset The address of the underlying asset of the reserve
   * @param reserveFactor The new reserve factor of the reserve
   **/
  public async setReserveFactor({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams) {
    this._onlyOwner(metadata.sender);
    // Define schema for the expected arguments
    const schema = z.tuple([z.string(), zUtils.bigint()]);

    // Parse arguments with validation
    const [asset, reserveFactor] = argsParsing(
      schema,
      args,
      "setReserveFactor"
    );

    const poolInctance = await loadContract<LendingPool>(ecosystem, this._pool);

    // Retrieve current reserve configuration
    const currentConfig = await poolInctance.getConfiguration([asset]);

    // Update the reserve factor
    currentConfig.setReserveFactor(reserveFactor);

    // Save the updated configuration
    await poolInctance.setConfiguration([asset, currentConfig]);

    eventLogger.log({
      type: EventTypes.RESERVE_FACTOR_SET,
      message: `Reserve factor for asset ${asset} has been set to ${reserveFactor.toString()} by ${metadata.sender}`,
    });
  }

  /**
   * @dev Configures the reserve collateralization parameters
   * all the values are expressed in percentages with two decimals of precision. A valid value is 10000, which means 100.00%
   * @param asset The address of the underlying asset of the reserve
   * @param ltv The loan to value of the asset when used as collateral
   * @param liquidationThreshold The threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param liquidationBonus The bonus liquidators receive to liquidate this asset. The values is always above 100%. A value of 105%
   * means the liquidator will receive a 5% bonus
   **/
  public async configureReserveAsCollateral({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams) {
    this._onlyOwner(metadata.sender);

    const schema = z.tuple([
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);
    const [asset, ltv, liquidationThreshold, liquidationBonus] = argsParsing(
      schema,
      args,
      "configureReserveAsCollateral"
    );

    const poolInctance = await loadContract<LendingPool>(ecosystem, this._pool);

    const currentConfig = await poolInctance.getConfiguration([asset]);

    // Validation: LTV must be less than or equal to the liquidation threshold
    if (ltv > liquidationThreshold) {
      throw new Error(Errors.LPC_INVALID_CONFIGURATION);
    }

    if (liquidationThreshold !== 0n) {
      // Validation: liquidation bonus must be greater than 100%
      if (liquidationBonus <= PercentageMath.PERCENTAGE_FACTOR) {
        throw new Error(Errors.LPC_INVALID_CONFIGURATION);
      }

      // Validation: ensure enough collateral is available to cover the liquidation bonus
      if (
        PercentageMath.percentMul(
          Number(liquidationThreshold),
          Number(liquidationBonus)
        ) > PercentageMath.PERCENTAGE_FACTOR
      ) {
        throw new Error(Errors.LPC_INVALID_CONFIGURATION);
      }
    } else {
      // If liquidation threshold is 0, liquidation bonus must be 0, and ensure no liquidity is deposited
      if (liquidationBonus !== 0n) {
        throw new Error(Errors.LPC_INVALID_CONFIGURATION);
      }
      await this._checkNoLiquidity(asset, ecosystem);
    }

    // Set new LTV, liquidation threshold, and liquidation bonus
    currentConfig.setLtv(ltv);
    currentConfig.setLiquidationThreshold(liquidationThreshold);
    currentConfig.setLiquidationBonus(liquidationBonus);
    // Update the pool configuration
    await poolInctance.setConfiguration([asset, currentConfig]);

    eventLogger.log({
      type: EventTypes.RESERVE_COLLATERALIZATION_CONFIGURED,
      message: `Reserve collateralization parameters for asset ${asset} have been configured by ${metadata.sender}`,
    });
  }

  /**
   * @dev Initializes reserves in batch
   **/
  public async batchInitReserve({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams) {
    this._onlyOwner(metadata.sender);
    const schema = z.tuple([InitReserveInputSchema.array()]);
    const [input] = argsParsing(schema, args, "batchInitReserve");

    for (const reserveInput of input) {
      await this._initReserve(reserveInput, ecosystem, eventLogger);
    }
  }

  private async _initReserve(
    input: InitReserveInput,
    ecosystem: Ecosystem,
    eventLogger: EventLogger
  ): Promise<void> {
    const aTokenName = getATokenName(input.underlyingAsset);
    try {
      await ecosystem.redeployContract(input.aTokenImpl, aTokenName);

      const deployedAToken = getRedeployedContractName(aTokenName);

      const aTokenInstance = await loadContract<AToken>(
        ecosystem,
        deployedAToken
      );

      await aTokenInstance.init([
        this._treasury,
        this._pool,
        input.underlyingAsset,
        input.underlyingAssetDecimals,
        deployedAToken,
        deployedAToken,
      ]);

      const stableDebtTokenName = getStableDebtTokenName(input.underlyingAsset);

      await ecosystem.redeployContract(
        input.stableDebtTokenImpl,
        stableDebtTokenName
      );

      const deployedStableDebtTokenName =
        getRedeployedContractName(stableDebtTokenName);

      const stableDebtTokenInstance = await loadContract<StableDebtToken>(
        ecosystem,
        deployedStableDebtTokenName
      );

      await stableDebtTokenInstance.init([
        this._pool,
        input.underlyingAsset,
        input.underlyingAssetDecimals,
        deployedStableDebtTokenName,
        deployedStableDebtTokenName,
      ]);

      const variableDebtTokenName = getVariableDebtTokenName(
        input.underlyingAsset
      );

      await ecosystem.redeployContract(
        input.variableDebtTokenImpl,
        variableDebtTokenName
      );

      const deployedVariableDebtTokenName = getRedeployedContractName(
        variableDebtTokenName
      );

      const variableDebtTokenInstance = await loadContract<VariableDebtToken>(
        ecosystem,
        deployedVariableDebtTokenName
      );

      await variableDebtTokenInstance.init([
        this._pool,
        input.underlyingAsset,
        input.underlyingAssetDecimals,
        deployedVariableDebtTokenName,
        deployedVariableDebtTokenName,
      ]);

      const poolIncance = await loadContract<LendingPool>(
        ecosystem,
        this._pool
      );

      await poolIncance.initReserve([
        input.underlyingAsset,
        deployedAToken,
        deployedStableDebtTokenName,
        deployedVariableDebtTokenName,
        input.interestRateStrategyAddress,
      ]);

      let currentConfig = await poolIncance.getConfiguration([
        input.underlyingAsset,
      ]);

      currentConfig.setDecimals(input.underlyingAssetDecimals);
      currentConfig.setActive(true);
      currentConfig.setFrozen(false);
      currentConfig.setStableRateBorrowingEnabled(true);

      await poolIncance.setConfiguration([
        input.underlyingAsset,
        currentConfig,
      ]);

      // Emit event for reserve initialization
      eventLogger.log({
        type: EventTypes.RESERVE_INITIALIZED,
        message: `Reserve initialized for asset ${input.underlyingAsset}`,
      });
    } catch (e) {
      console.log("Failed to initialize Reserve: " + e);
    }
  }

  private async _checkNoLiquidity(asset: string, ecosystem: Ecosystem) {
    const poolInctance = await loadContract<LendingPool>(ecosystem, this._pool);

    const reserveData = poolInctance.getReserveData([asset]);

    const assetInctane = await loadContract<LRC20Base>(ecosystem, asset);

    const availableLiquidity = assetInctane.balanceOf([
      reserveData.aTokenAddress,
    ]);

    if (
      !(availableLiquidity === 0n && reserveData.currentLiquidityRate === 0n)
    ) {
      throw new Error(Errors.LPC_RESERVE_LIQUIDITY_NOT_0);
    }
  }
}
