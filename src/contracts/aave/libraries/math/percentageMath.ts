// PercentageMath.ts

import { Errors } from "../helpers/errors";

/**
 * @title PercentageMath library
 * @author Aave
 * @notice Provides functions to perform percentage calculations
 * @dev Percentages are defined by default with 2 decimals of precision (100.00). The precision is indicated by PERCENTAGE_FACTOR
 * @dev Operations are rounded half up
 */
export class PercentageMath {
  // Constants for percentage calculations
  static PERCENTAGE_FACTOR = 1e4; // percentage plus two decimals
  static HALF_PERCENT = this.PERCENTAGE_FACTOR / 2;
  /**
   * @dev Executes a percentage multiplication
   * @param value The value of which the percentage needs to be calculated
   * @param percentage The percentage of the value to be calculated
   * @return The percentage of value
   */
  static percentMul(value: number, percentage: number): number {
    if (value === 0 || percentage === 0) {
      return 0;
    }

    if (value > (Number.MAX_SAFE_INTEGER - this.HALF_PERCENT) / percentage) {
      throw new Error(Errors.MATH_MULTIPLICATION_OVERFLOW);
    }

    return Math.floor(
      (value * percentage + this.HALF_PERCENT) / this.PERCENTAGE_FACTOR
    );
  }

  /**
   * @dev Executes a percentage division
   * @param value The value of which the percentage needs to be calculated
   * @param percentage The percentage of the value to be calculated
   * @return The value divided by the percentage
   */
  static percentDiv(value: number, percentage: number): number {
    if (percentage === 0) {
      throw new Error(Errors.MATH_DIVISION_BY_ZERO);
    }

    const halfPercentage = Math.floor(percentage / 2);

    if (
      value >
      (Number.MAX_SAFE_INTEGER - halfPercentage) / this.PERCENTAGE_FACTOR
    ) {
      throw new Error(Errors.MATH_MULTIPLICATION_OVERFLOW);
    }

    return Math.floor(
      (value * this.PERCENTAGE_FACTOR + halfPercentage) / percentage
    );
  }
}
