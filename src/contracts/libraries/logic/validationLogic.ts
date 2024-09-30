import { ReserveData } from "@/contracts/lendingPool";
import { Errors } from "../helpers/errors";
import { InterestRateMode, UserConfigurationMap } from "../types/dataTypes";
import { GenericLogic, HEALTH_FACTOR_LIQUIDATION_THRESHOLD } from "./genericLogic";
import { UserConfiguration } from "../configuration/userConfiguration";
import { Ecosystem } from "@/contracts/types/ecosystem";
import { BigNumber } from 'bignumber.js';

export class ValidationLogic {
    public errors = Errors
    // genericLogic = GenericL

    public async validateBorrow(
        asset: string,
        reserve: ReserveData,
        userAddress: string,
        amount: bigint,
        amountInETH: bigint,
        interestRateMode: number,
        maxStableLoanPercent: bigint,
        reservesData: Map<string, ReserveData>,
        userConfig: UserConfiguration,
        reserves: string[],
        reservesCount: number,
        oracle: string,
        ecosystem: Ecosystem
    ): Promise<void> {
        const {
            isActive,
            isFrozen,
            borrowingEnabled,
            stableRateBorrowingEnabled,
        } = reserve.configuration.getFlags();

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
            userCollateralBalanceETH,
            userBorrowBalanceETH,
            currentLtv,
            currentLiquidationThreshold,
            healthFactor,
        ] = await GenericLogic.calculateUserAccountData(
            userAddress,
            reservesData,
            userConfig,
            reserves,
            reservesCount,
            oracle,
            ecosystem
        );

        if (userCollateralBalanceETH.lte(0)) throw new Error(Errors.VL_COLLATERAL_BALANCE_IS_0);
        if (healthFactor <= HEALTH_FACTOR_LIQUIDATION_THRESHOLD) {
            throw new Error(Errors.VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD);
        }

        // Calculate the collateral needed
        const amountOfCollateralNeededETH = userBorrowBalanceETH.plus(amountInETH.toString()).div((currentLtv.div(100)));

        if (amountOfCollateralNeededETH > userCollateralBalanceETH) {
            throw new Error(Errors.VL_COLLATERAL_CANNOT_COVER_NEW_BORROW);
        }

        // Check stable borrow conditions
        if (interestRateMode === InterestRateMode.STABLE) {
            if (!stableRateBorrowingEnabled) {
                throw new Error(Errors.VL_STABLE_BORROWING_NOT_ENABLED);
            }

            if (
                userConfig.isUsingAsCollateral(reserve.id) &&
                (reserve.configuration.getLtv() > 0 || new BigNumber(amount.toString()).lte(await GenericLogic.getBalance(reserve.aTokenAddress, userAddress, ecosystem))
                )) {
                throw new Error(Errors.VL_COLLATERAL_SAME_AS_BORROWING_CURRENCY);
            }

            const availableLiquidity = await GenericLogic.getBalance(asset, reserve.aTokenAddress, ecosystem)
            const maxLoanSizeStable = availableLiquidity.multipliedBy(maxStableLoanPercent.toString()).div(100);

            if (new BigNumber(amount.toString()).gte(maxLoanSizeStable)) {
                throw new Error(Errors.VL_AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE);
            }
        }
    }
}