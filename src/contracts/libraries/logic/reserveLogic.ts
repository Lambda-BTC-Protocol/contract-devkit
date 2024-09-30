import { ReserveData } from "@/contracts/lendingPool";
import { MathUtils } from "../math/mathUtils";

// Main GenericLogic class
export class ReserveLogic {
  /**
   * @dev Returns the ongoing normalized variable debt for the reserve
   * A value of 1e27 means there is no debt. As time passes, the income is accrued
   * A value of 2*1e27 means that for each unit of debt, one unit worth of interest has been accumulated
   * @param reserve The reserve object
   * @return The normalized variable debt, expressed in ray
   */
  getNormalizedDebt(reserve: ReserveData): bigint {
    const timestamp = reserve.lastUpdateTimestamp;
    const currentTimestamp = Math.floor(Date.now() / 1000); // Get current Unix timestamp

    if (timestamp === currentTimestamp) {
      // If the index was updated in the same block, no need to perform any calculation
      return reserve.variableBorrowIndex;
    }

    const cumulatedInterest = MathUtils.calculateCompoundedInterest(
      reserve.currentVariableBorrowRate,
      timestamp
    );

    // Return the cumulated interest multiplied by the current variable borrow index
    return (cumulatedInterest * reserve.variableBorrowIndex) / BigInt(1e27);
  }
}
