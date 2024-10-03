import { Ecosystem } from "@/contracts/types/ecosystem";
import { LRC20Base } from "@/contracts/standards/base/LRC20Base";
import { ReserveData } from "../types/dataTypes";
import { loadContract } from "@/lib/utils";

export class Helpers {
  /**
   * Fetches the user's current stable and variable debt balances.
   * @param user The user address
   * @param reserve The reserve data object
   * @returns A tuple with the stable and variable debt balances.
   */
  static async getUserCurrentDebt(
    user: string,
    reserve: ReserveData,
    ecosystem: Ecosystem
  ): Promise<[bigint, bigint]> {
    const stableDebtToken = await loadContract<LRC20Base>(
      ecosystem,
      reserve.stableDebtTokenAddress
    );
    const variableDebtToken = await loadContract<LRC20Base>(
      ecosystem,
      reserve.variableDebtTokenAddress
    );

    const stableDebtBalance = await stableDebtToken.balanceOf([user]);
    const variableDebtBalance = await variableDebtToken.balanceOf([user]);

    return [stableDebtBalance ?? 0n, variableDebtBalance ?? 0n];
  }

  /**
   * Fetches the user's current stable and variable debt balances using memory for the reserve.
   * @param user The user address
   * @param reserve The reserve data object in memory
   * @returns A tuple with the stable and variable debt balances.
   */
  static async getUserCurrentDebtMemory(
    user: string,
    reserve: ReserveData,
    ecosystem: Ecosystem
  ): Promise<[bigint, bigint]> {
    const stableDebtToken = await loadContract<LRC20Base>(
      ecosystem,
      reserve.stableDebtTokenAddress
    );
    const variableDebtToken = await loadContract<LRC20Base>(
      ecosystem,
      reserve.variableDebtTokenAddress
    );

    const stableDebtBalance = await stableDebtToken.balanceOf([user]);
    const variableDebtBalance = await variableDebtToken.balanceOf([user]);

    return [stableDebtBalance ?? 0n, variableDebtBalance ?? 0n];
  }
}
