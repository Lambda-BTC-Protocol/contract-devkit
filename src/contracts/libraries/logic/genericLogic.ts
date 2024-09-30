import { ReserveData } from '@/contracts/lendingPool';
import { BigNumber } from 'bignumber.js';
import { ethers } from 'ethers';
import { UserConfiguration } from '../configuration/userConfiguration';
import { Ecosystem } from '@/contracts/types/ecosystem';
import aToken from '@/contracts/aToken';
import { ExecutionError } from '@/contracts/types/execution-error';

// Constants
export const HEALTH_FACTOR_LIQUIDATION_THRESHOLD = BigNumber("1000000000000000000") // 1 ether

// Utility functions for math (adapt WadRayMath, SafeMath, PercentageMath)
class MathUtils {
    static wadDiv(a: BigNumber, b: BigNumber): BigNumber {
        return a.div(b);
    }

    static percentMul(a: BigNumber, b: BigNumber): BigNumber {
        return a.multipliedBy(b).dividedBy(new BigNumber(10000)); // 100% is 10000 basis points
    }

    static mulDiv(a: BigNumber, b: BigNumber, div: BigNumber): BigNumber {
        return a.multipliedBy(b).dividedBy(div);
    }
}

// Main GenericLogic class
export class GenericLogic {
    static async calculateUserAccountData(
        user: string,
        reservesData: Map<string, ReserveData>,
        userConfig: UserConfiguration,
        reserves: string[],
        reservesCount: number,
        oracle: any,
        ecosystem: Ecosystem
    ): Promise<[BigNumber, BigNumber, BigNumber, BigNumber, BigNumber]> {
        let totalCollateralInETH = new BigNumber(0);
        let totalDebtInETH = new BigNumber(0);
        let avgLtv = new BigNumber(0);
        let avgLiquidationThreshold = new BigNumber(0);

        if (userConfig.isEmpty()) {
            return [new BigNumber(0), new BigNumber(0), new BigNumber(0), new BigNumber(0), new BigNumber(-1)];
        }

        for (let i = 0; i < reservesCount; i++) {
            if (!userConfig.isUsingAsCollateralOrBorrowing(i)) {
                continue;
            }

            const currentReserveAddress = reserves[i];
            const currentReserve = reservesData.get(currentReserveAddress);
            if (!currentReserve) continue;

            const { ltv, liquidationThreshold, decimals } = currentReserve.configuration.getParams();
            const tokenUnit = new BigNumber(10).pow(Number(decimals));
            const reserveUnitPrice = await oracle.getAssetPrice(currentReserveAddress);

            if (liquidationThreshold > 0n && userConfig.isUsingAsCollateral(i)) {
                const compoundedLiquidityBalance = await this.getBalance(currentReserve.aTokenAddress, user, ecosystem);
                const liquidityBalanceETH = reserveUnitPrice.multipliedBy(compoundedLiquidityBalance).div(tokenUnit);

                totalCollateralInETH = totalCollateralInETH.plus(liquidityBalanceETH);
                avgLtv = avgLtv.plus(liquidityBalanceETH.multipliedBy(ltv));
                avgLiquidationThreshold = avgLiquidationThreshold.plus(
                    liquidityBalanceETH.multipliedBy(liquidationThreshold)
                );
            }

            if (userConfig.isBorrowing(i)) {
                let compoundedBorrowBalance = await this.getBalance(currentReserve.stableDebtTokenAddress, user, ecosystem);
                compoundedBorrowBalance = compoundedBorrowBalance.plus(
                    await this.getBalance(currentReserve.variableDebtTokenAddress, user, ecosystem)
                );

                totalDebtInETH = totalDebtInETH.plus(
                    reserveUnitPrice.multipliedBy(compoundedBorrowBalance).div(tokenUnit)
                );
            }
        }

        avgLtv = totalCollateralInETH.gt(0) ? avgLtv.div(totalCollateralInETH) : new BigNumber(0);
        avgLiquidationThreshold = totalCollateralInETH.gt(0)
            ? avgLiquidationThreshold.div(totalCollateralInETH)
            : new BigNumber(0);

        const healthFactor = this.calculateHealthFactorFromBalances(
            totalCollateralInETH,
            totalDebtInETH,
            avgLiquidationThreshold
        );

        return [totalCollateralInETH, totalDebtInETH, avgLtv, avgLiquidationThreshold, healthFactor];
    }

    static calculateHealthFactorFromBalances(
        totalCollateralInETH: BigNumber,
        totalDebtInETH: BigNumber,
        liquidationThreshold: BigNumber
    ): BigNumber {
        if (totalDebtInETH.isZero()) return new BigNumber(-1);
        return MathUtils.wadDiv(totalCollateralInETH.multipliedBy(liquidationThreshold), totalDebtInETH);
    }

    static async getBalance(tokenAddress: string, user: string, ecosystem: Ecosystem): Promise<BigNumber> {
        const tokenContract = await ecosystem.getContractObj<aToken>(
            tokenAddress
        );

        if (!tokenContract) {
            throw new ExecutionError("Burn: cannot get token");
        }
        const balance = await tokenContract.balanceOf([user]);
        // const tokenContract = new ethers.Contract(tokenAddress, ['function balanceOf(address) view returns (uint256)'], ethers.provider);
        // const balance = await tokenContract.balanceOf(user);
        return new BigNumber(balance.toString());
    }

    static calculateAvailableBorrowsETH(
        totalCollateralInETH: BigNumber,
        totalDebtInETH: BigNumber,
        ltv: BigNumber
    ): BigNumber {
        let availableBorrowsETH = MathUtils.percentMul(totalCollateralInETH, ltv);

        if (availableBorrowsETH.lt(totalDebtInETH)) {
            return new BigNumber(0);
        }

        availableBorrowsETH = availableBorrowsETH.minus(totalDebtInETH);
        return availableBorrowsETH;
    }
}
