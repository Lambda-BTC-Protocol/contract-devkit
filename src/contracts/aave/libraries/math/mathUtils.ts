import { WadRayMath } from "./wadRayMath";

export const MAX_UINT256 = BigInt(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935"
);

export class MathUtils {
  static SECONDS_PER_YEAR = BigInt(365 * 24 * 60 * 60); // 365 days in seconds
  /**
   * @dev Function to calculate the interest accumulated using a linear interest rate formula
   * @param rate The interest rate, in ray
   * @param lastUpdateTimestamp The timestamp of the last update of the interest
   * @return The interest rate linearly accumulated during the timeDelta, in ray
   */
  static calculateLinearInterest(
    rate: bigint,
    lastUpdateTimestamp: number
  ): bigint {
    const timeDifference =
      BigInt(Date.now() / 1000) - BigInt(lastUpdateTimestamp);
    const ray = WadRayMath.ray();

    return (rate * timeDifference) / this.SECONDS_PER_YEAR + ray;
  }

  /**
   * @dev Function to calculate the interest using a compounded interest rate formula
   * To avoid expensive exponentiation, the calculation is performed using a binomial approximation:
   *
   *  (1+x)^n = 1+n*x+[n/2*(n-1)]*x^2+[n/6*(n-1)*(n-2)*x^3...
   *
   * @param rate The interest rate, in ray
   * @param lastUpdateTimestamp The timestamp of the last update of the interest
   * @param currentTimestamp The current block timestamp
   * @return The interest rate compounded during the timeDelta, in ray
   */
  static calculateCompoundedInterestWithFormula(
    rate: bigint,
    lastUpdateTimestamp: number,
    currentTimestamp: number
  ): bigint {
    const exp = BigInt(currentTimestamp) - BigInt(lastUpdateTimestamp);

    if (exp === BigInt(0)) {
      return WadRayMath.ray();
    }

    const expMinusOne = exp - BigInt(1);
    const expMinusTwo = exp > BigInt(2) ? exp - BigInt(2) : BigInt(0);
    const ratePerSecond = rate / this.SECONDS_PER_YEAR;

    const basePowerTwo = WadRayMath.rayMul(ratePerSecond, ratePerSecond);
    const basePowerThree = WadRayMath.rayMul(basePowerTwo, ratePerSecond);

    const secondTerm = (exp * expMinusOne * basePowerTwo) / BigInt(2);
    const thirdTerm =
      (exp * expMinusOne * expMinusTwo * basePowerThree) / BigInt(6);

    return WadRayMath.ray() + ratePerSecond * exp + secondTerm + thirdTerm;
  }

  /**
   * @dev Calculates the compounded interest between the timestamp of the last update and the current block timestamp
   * @param rate The interest rate (in ray)
   * @param lastUpdateTimestamp The timestamp from which the interest accumulation needs to be calculated
   */
  static calculateCompoundedInterest(
    rate: bigint,
    lastUpdateTimestamp: number
  ): bigint {
    return this.calculateCompoundedInterestWithFormula(
      rate,
      lastUpdateTimestamp,
      Math.floor(Date.now() / 1000)
    );
  }
}
