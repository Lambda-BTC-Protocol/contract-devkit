import { Contract, ContractParams } from "./types/contract";
import { zUtils } from "./utils/zod";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing";
import { ExecutionError } from "./types/execution-error";
import { persistenceStorage } from "../persistenceStorage";
import aToken, { aToken as aTokenTemplate } from "./aToken";
import { LRC20Base } from "./standards/base/LRC20Base";
import TokenManager from "./tokenManager";
import { Ecosystem } from "./types/ecosystem";
import { DEPLOY_PREFIX } from "./utils/DEPLOY_PREFIX";
import { getAToken } from "./utils/token-manager";
import { on } from "events";
import { VariableDebtToken } from "./variableDebtToken";
import { UserConfiguration } from "./libraries/configuration/userConfiguration";
import { ReserveConfiguration } from "./libraries/configuration/reserveConfiguration";
import { ValidationLogic } from "./libraries/logic/validationLogic";
import Oracle from "./oracle";
import { ReserveLogic } from "./libraries/logic/reserveLogic";
import { MathUtils } from "./libraries/math/mathUtils";
import StableDebtToken from "./stableDebtToken";
import { WadRayMath } from "./libraries/math/wadRayMath";
import { PercentageMath } from "./libraries/math/percentageMath";

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
  id: number;

  constructor(
    configuration: ReserveConfiguration,
    liquidityIndex: bigint,
    variableBorrowIndex: bigint,
    currentLiquidityRate: bigint,
    currentVariableBorrowRate: bigint,
    currentStableBorrowRate: bigint,
    lastUpdateTimestamp: number,
    aTokenAddress: string,
    stableDebtTokenAddress: string,
    variableDebtTokenAddress: string,
    interestRateStrategyAddress: string,
    id: number
  ) {
    (this.configuration = configuration),
      (this.liquidityIndex = liquidityIndex),
      (this.variableBorrowIndex = variableBorrowIndex),
      (this.currentLiquidityRate = currentLiquidityRate),
      (this.currentVariableBorrowRate = currentVariableBorrowRate),
      (this.currentStableBorrowRate = currentStableBorrowRate),
      (this.lastUpdateTimestamp = lastUpdateTimestamp),
      (this.aTokenAddress = aTokenAddress),
      (this.stableDebtTokenAddress = stableDebtTokenAddress),
      (this.variableDebtTokenAddress = variableDebtTokenAddress),
      (this.interestRateStrategyAddress = interestRateStrategyAddress);
    this.id = id;
  }

  /**
   * @dev Updates the liquidity cumulative index and the variable borrow index.
   * @param reserve The reserve object
   **/
  async updateState( ecosystem: Ecosystem ) {
    const variableDebtToken = await ecosystem.getContractObj<VariableDebtToken>(
      this.variableDebtTokenAddress
    );
    if (!variableDebtToken) {
      throw new ExecutionError(
        `VariableDebtToken ${this.variableDebtTokenAddress} not found`
      );
    }
    const scaledVariableDebt = variableDebtToken.scaledTotalSupply([]);
    const previousVariableBorrowIndex = this.variableBorrowIndex;
    const previousLiquidityIndex = this.liquidityIndex;
    const lastUpdatedTimestamp = this.lastUpdateTimestamp;

    const [newLiquidityIndex, newVariableBorrowIndex] = this._updateIndexes(
      this,
      scaledVariableDebt,
      previousLiquidityIndex,
      previousVariableBorrowIndex,
      lastUpdatedTimestamp
    );

    this._mintToTreasury(
      this,
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

    const stableDeptsToken = await ecosystem.getContractObj<StableDebtToken>(
      reserve.stableDebtTokenAddress
    );

    if (!stableDeptsToken) {
      throw new ExecutionError(
        `StableDebtToken ${reserve.stableDebtTokenAddress} not found`
      );
    }

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
    const cumulatedStableInterest = MathUtils.calculateCompoundedInterest(
      avgStableRate,
      stableSupplyUpdatedTimestamp
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
      const aToken = await ecosystem.getContractObj<aToken>(
        reserve.aTokenAddress
      );
      if (!aToken) {
        throw new Error("aToken not found");
      }
      // await IAToken(reserve.aTokenAddress).mintToTreasury(
      //   amountToMint,
      //   newLiquidityIndex
      // );
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
    if (currentLiquidityRate > 0) {
      const cumulatedLiquidityInterest = MathUtils.calculateLinearInterest(
        currentLiquidityRate,
        timestamp
      );
      newLiquidityIndex *= cumulatedLiquidityInterest;

      // Check for overflow
      if (newLiquidityIndex > Number.MAX_SAFE_INTEGER) {
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
  // async updateState({
  //   metadata,
  //   args,
  //   eventLogger,
  //   ecosystem,
  // }: ContractParams) {
  //   const variableDebtToken = await ecosystem.getContractObj<VariableDebtToken>(
  //     this.variableDebtTokenAddress
  //     // scaledVariableDebt =
  //     //   IVariableDebtToken(reserve.variableDebtTokenAddress).scaledTotalSupply();
  //   );
  // }
  // uint256 previousVariableBorrowIndex = reserve.variableBorrowIndex;
  //     uint256 previousLiquidityIndex = reserve.liquidityIndex;
  //     uint40 lastUpdatedTimestamp = reserve.lastUpdateTimestamp;

  //     (uint256 newLiquidityIndex, uint256 newVariableBorrowIndex) =
  //       _updateIndexes(
  //         reserve,
  //         scaledVariableDebt,
  //         previousLiquidityIndex,
  //         previousVariableBorrowIndex,
  //         lastUpdatedTimestamp
  //       );

  //     _mintToTreasury(
  //       reserve,
  //       scaledVariableDebt,
  //       previousVariableBorrowIndex,
  //       newLiquidityIndex,
  //       newVariableBorrowIndex,
  //       lastUpdatedTimestamp
  //     );
  //   }
}
export default class LendingPool implements Contract {
  activeOn = 100;

  private _tokenBalances = new Map<string, Map<string, bigint>>();
  private _totalBalances = new Map<string, bigint>();
  private _borrowedBalances = new Map<string, Map<string, bigint>>();
  private _collateralBalances = new Map<string, bigint>();
  private _collateralFactor = 1.5;
  private _healthFactor = new Map<string, bigint>();
  // private _reserveConfiguration = new Map<ReserveData, ReserveConfigurationMap>();
  private _reserves = new Map<string, ReserveData>();
  private _usersConfig = new Map<string, UserConfiguration>();
  private _validationLogic = new ValidationLogic();
  private _reserveLogic = new ReserveLogic();
  private _maxStableRateBorrowSizePercent = 2500n;
  private _flashLoanPremiumTotal = 9;
  private _maxNumberOfReserves = 128;

  async validateDeposit(reserve: ReserveData, amount: bigint) {
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

  async configureReserve({ args }: ContractParams) {
    const schema = z.tuple([
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      z.bigint(),
      z.boolean(),
      z.boolean(),
      z.boolean(),
      z.boolean(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      zUtils.bigint(),
      z.number(),
      z.string(),
      z.string(),
      z.string(),
      z.number(),
    ]);
    const [
      reserve,
      ltv,
      liquidationThreshold,
      liquidationBonus,
      decimals,
      isActive,
      isFrozen,
      borrowingEnabled,
      stableRateBorrowingEnabled,
      reserveFactor,
      liquidityIndex,
      variableBorrowIndex,
      currentLiquidityRate,
      currentVariableBorrowRate,
      currentStableBorrowRate,
      lastUpdateTimestamp,
      stableDebtTokenAddress,
      variableDebtTokenAddress,
      interestRateStrategyAddress,
      id,
    ] = argsParsing(schema, args, "configureReserve");
    const reserveConfig = new ReserveConfiguration(
      ltv,
      liquidationThreshold,
      liquidationBonus,
      decimals,
      reserveFactor,
      isActive,
      isFrozen,
      borrowingEnabled,
      stableRateBorrowingEnabled
    );
    const reserveData = new ReserveData(
      reserveConfig,
      liquidityIndex,
      variableBorrowIndex,
      currentLiquidityRate,
      currentVariableBorrowRate,
      currentStableBorrowRate,
      lastUpdateTimestamp,
      getAToken(reserve),
      stableDebtTokenAddress,
      variableDebtTokenAddress,
      interestRateStrategyAddress,
      id
    );
    this._reserves.set(reserve, reserveData);
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
    await this.validateDeposit(reserve, amount);
    // await reserve.updateState();
    const aToken = await ecosystem.getContractObj<aTokenTemplate>(
      reserve.aTokenAddress
    );

    if (!aToken) {
      throw new ExecutionError(
        `a${token} contract not found or failed to deploy`
      );
    }

    const Token = await ecosystem.getContractObj<LRC20Base>(token);
    if (!Token) throw new ExecutionError(`${token} contract not found`);

    await Token.transferFrom([
      metadata.sender,
      metadata.currentContract,
      amount,
    ]);

    const totalBalance = this._totalBalances.get(token) ?? 0n;
    this._totalBalances.set(token, totalBalance + amount);

    await aToken.mint([onBehalfOf, amount]);

    const exchangeRate = 1n; // TODO: Get exchange rate from AMM
    const dollarValueAmount = amount * exchangeRate;

    const collateralBalance = this._collateralBalances.get(onBehalfOf) ?? 0n;
    this._collateralBalances.set(
      onBehalfOf,
      collateralBalance + dollarValueAmount
    );

    console.log(aToken.balanceOf([onBehalfOf]));

    eventLogger.log({
      type: "DEPOSIT",
      message: `${metadata.sender} deposited ${amount} ${token} on behalf of ${onBehalfOf}`,
    });

    eventLogger.log({
      type: "MINT_ATOKEN",
      message: `Minted ${amount} a${token} for ${onBehalfOf}`,
    });
  }

  /**
   * Withdraw tokens from the lending pool, burns aTokens
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @param eventLogger - Event logger
   * @param ecosystem - Ecosystem
   */
  async withdraw({ metadata, args, eventLogger, ecosystem }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint(), z.string()]);
    const [token, amount, to] = argsParsing(schema, args, "withdraw");

    const Token = await ecosystem.getContractObj<LRC20Base>(token);
    if (!Token) throw new ExecutionError(`${token} contract not found`);

    const aToken = await ecosystem.getContractObj<aTokenTemplate>(`a${token}`);

    if (!aToken) {
      throw new ExecutionError(
        `a${token} contract not found or failed to deploy`
      );
    }

    const aTokenBalances = aToken.balanceOf([to]);
    console.log(aTokenBalances);

    if (aTokenBalances < amount) {
      throw new ExecutionError("withdraw: not enough aToken balance");
    }

    const collateralBalance = this._collateralBalances.get(to);
    if (!collateralBalance) {
      throw new ExecutionError("withdraw: collateral balance not found");
    }

    aToken.burn([to, amount]);
    Token.transfer([metadata.sender, amount]);

    const exchangeRate = 1n; // TODO: Get exchange rate from AMM
    const dollarValueAmount = amount * exchangeRate;

    this._collateralBalances.set(token, collateralBalance - dollarValueAmount);

    console.log(aToken.balanceOf([metadata.sender]));

    eventLogger.log({
      type: "WITHDRAW",
      message: `${to} withdraw ${amount} ${token} to ${metadata.sender}`,
    });

    eventLogger.log({
      type: "BURN_ATOKEN",
      message: `Burned ${amount} a${token} from ${to}`,
    });
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
   * Borrow tokens from the lending pool, requires collateral
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @param eventLogger - Event logger
   * @param ecosystem - Ecosystem, contains all the contracts
   */

  // async borrow({ metadata, args, eventLogger, ecosystem }: ContractParams) {
  //   // TO DO: Check borrow logic
  //   const schema = z.tuple([z.string(), zUtils.bigint(), z.string()]);
  //   console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", args);

  //   let [asset, amount, onBehalfOf] = argsParsing(schema, args, "borrow");
  //   const token = await ecosystem.getContractObj<LRC20Base>(asset);
  //   if (!token) throw new ExecutionError("Token contract not found");

  //   const collateralPercentage = BigInt(this._collateralFactor * 100);
  //   const requiredCollateral = (collateralPercentage * amount) / 100n;
  //   const collateral = this._collateralBalances.get(metadata.sender) ?? 10n;
  //   console.log(collateral);
  //   if (collateral <= 0n) {
  //     throw new ExecutionError("Not enough collateral");
  //   }

  //   token.transfer([onBehalfOf, amount]);
  //   this._collateralBalances.set(onBehalfOf, collateral - requiredCollateral);

  //   const borrowedBalance =
  //     this._borrowedBalances.get(onBehalfOf) ?? new Map<string, bigint>();
  //   borrowedBalance.set(asset, borrowedBalance.get(asset) ?? 0n + amount);

  //   const totalBalance = this._totalBalances.get(asset) ?? 0n;
  //   this._totalBalances.set(asset, totalBalance + amount);

  //   eventLogger.log({
  //     type: "BORROW",
  //     message: `${onBehalfOf} borrowed ${amount} ${asset} for ${metadata.sender}`,
  //   });
  // }
  async borrow({ metadata, args, eventLogger, ecosystem }: ContractParams) {
    const schema = z.tuple([
      z.string(), // asset
      zUtils.bigint(), // amount
      z.number(), // interestRateMode (e.g. stable or variable)
      z.number(), // referralCode
      z.string(), // onBehalfOf
    ]);

    const [asset, amount, interestRateMode, referralCode, onBehalfOf] =
      argsParsing(schema, args, "borrow");
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
      referralCode,
      releaseUnderlying: true,
      ecosystem,
    });

    eventLogger.log({
      type: "BORROW",
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
    referralCode,
    releaseUnderlying,
    ecosystem,
  }: {
    asset: string;
    user: string;
    onBehalfOf: string;
    amount: bigint;
    interestRateMode: number;
    aTokenAddress: string;
    referralCode: number;
    releaseUnderlying: boolean;
    ecosystem: Ecosystem;
  }) {
    const reserve = this._reserves.get(asset);
    if (!reserve) throw new ExecutionError("Reserve not found");

    const userConfig = this._usersConfig.get(onBehalfOf);

    if (!userConfig) {
      throw new ExecutionError("User config not found");
    }

    const oracle = await ecosystem.getContractObj<Oracle>("Oracle");

    if (!oracle) {
      throw new ExecutionError("Oracle not found");
    }

    const assetPrice = await oracle.getAssetPrice([asset]);

    if (!assetPrice) {
      throw new ExecutionError("Oracle asset price not found");
    }

    const amountInPUSD =
      (assetPrice * amount) / 10n ** reserve.configuration.getDecimals();

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
      this._reserves.values.length,
      "Oracle",
      ecosystem
    );

    // Update reserve state before minting
    await reserve.updateState(ecosystem);

    let isFirstBorrowing = false;
    let currentRate = 0n;

    // Determine if stable or variable rate
    // if (interestRateMode === 1) {
    //   // STABLE
    //   currentRate = reserve.currentStableBorrowRate;
    //   const stableDebtToken = await ecosystem.getContractObj<VariableDebtToken>(
    //     reserve.stableDebtTokenAddress
    //   );
    //   isFirstBorrowing = await stableDebtToken.mint([
    //     user,
    //     onBehalfOf,
    //     amount,
    //     currentRate,
    //   ]);
    // } else {
    //   const variableDebtToken =
    //     await ecosystem.getContractObj<VariableDebtToken>(
    //       reserve.variableDebtTokenAddress
    //     );
    //   isFirstBorrowing = await variableDebtToken.mint([
    //     user,
    //     onBehalfOf,
    //     amount,
    //     reserve.variableBorrowIndex,
    //   ]);
    // }

    // if (isFirstBorrowing) {
    //   userConfig.setBorrowing(reserve.id, true);
    // }

    // // Update interest rates
    // await reserve.updateInterestRates({
    //   asset,
    //   aTokenAddress,
    //   amount: releaseUnderlying ? amount : 0n,
    // });

    // if (releaseUnderlying) {
    //   const aToken = await ecosystem.getContractObj<any>(aTokenAddress);
    //   await aToken.transferUnderlyingTo([user, amount]);
    // }

    // eventLogger.log({
    //   type: "BORROW_EXECUTED",
    //   message: `${user} executed a borrow of ${amount} ${asset} on behalf of ${onBehalfOf}`,
    // });
  }

  /**
   * Repay borrowed tokens, requires collateral to be deposited
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @param eventLogger - Event logger
   *  @param ecosystem - Ecosystem, contains all the contracts
   */

  async repay({ metadata, args, eventLogger, ecosystem }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint(), z.string()]);
    const [asset, amount, onBehalfOf] = argsParsing(schema, args, "repay");

    const collateralBalance =
      this._collateralBalances.get(metadata.sender) ?? 0n;
    const borrowedBalance =
      this._borrowedBalances.get(metadata.sender) ?? new Map<string, bigint>();
    const borrowedTokenBalance = borrowedBalance.get(asset) ?? 0n;
    const repayCollateral =
      (BigInt(this._collateralFactor * 100) * amount) / 100n;

    const token = await ecosystem.getContractObj<LRC20Base>(asset);
    if (!token) throw new ExecutionError("Token contract not found");

    token.transferFrom([metadata.sender, metadata.currentContract, amount]);

    borrowedBalance.set(asset, borrowedTokenBalance - amount);
    this._borrowedBalances.set(onBehalfOf, borrowedBalance);

    this._collateralBalances.set(
      onBehalfOf,
      collateralBalance + repayCollateral
    );

    eventLogger.log({
      type: "REPAY",
      message: `${metadata.sender} repaid ${amount} ${asset} for ${onBehalfOf}`,
    });
  }

  /**
   * @dev Returns the normalized variable debt per unit of asset
   * @param asset The address (or unique identifier) of the underlying asset of the reserve
   * @return The reserve normalized variable debt
   */
  getReserveNormalizedVariableDebt(asset: string): bigint {
    const reserve = this._reserves.get(asset);
    if (!reserve) {
      throw new Error(`Reserve for asset ${asset} not found`);
    }
    return this._reserveLogic.getNormalizedDebt(reserve);
  }

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

    const token = await ecosystem.getContractObj<LRC20Base>(debtAsset);
    const collateralAssetToken =
      await ecosystem.getContractObj<LRC20Base>(collateralAsset);
    if (!token) throw new ExecutionError("Token contract not found");
    if (!collateralAssetToken)
      throw new ExecutionError("Collateral asset contract not found");

    token.transfer([metadata.sender, debtToCover]);
    collateralAssetToken.transfer([user, requiredCollateral]);

    borrowedBalance.set(debtAsset, borrowedTokenBalance - debtToCover);
    this._borrowedBalances.set(user, borrowedBalance);

    this._collateralBalances.set(user, collateralBalance - requiredCollateral);

    eventLogger.log({
      type: "LIQUIDATION",
      message: `${metadata.sender} liquidated ${debtToCover} ${debtAsset} for ${user}`,
    });
  }
}
