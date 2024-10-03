export class UserConfiguration {
  // Arrays to track borrowing and collateral usage status for reserves
  borrowingStatus: boolean[];
  collateralStatus: boolean[];

  constructor(reserveCount: number = 128) {
    // Initialize the borrowing and collateral arrays with 'false' (not borrowing or using as collateral)
    this.borrowingStatus = Array(reserveCount).fill(false);
    this.collateralStatus = Array(reserveCount).fill(false);
  }

  /**
   * @dev Sets if the user is borrowing the reserve identified by reserveIndex
   * @param reserveIndex The index of the reserve
   * @param borrowing True if the user is borrowing the reserve, false otherwise
   */
  setBorrowing(reserveIndex: number, borrowing: boolean): void {
    if (reserveIndex >= this.borrowingStatus.length) {
      throw new Error("Invalid reserve index");
    }
    this.borrowingStatus[reserveIndex] = borrowing;
  }

  /**
   * @dev Sets if the user is using as collateral the reserve identified by reserveIndex
   * @param reserveIndex The index of the reserve
   * @param usingAsCollateral True if the user is using the reserve as collateral, false otherwise
   */
  setUsingAsCollateral(reserveIndex: number, usingAsCollateral: boolean): void {
    if (reserveIndex >= this.collateralStatus.length) {
      throw new Error("Invalid reserve index");
    }
    this.collateralStatus[reserveIndex] = usingAsCollateral;
  }

  /**
   * @dev Check if the user is borrowing or using as collateral for the reserve identified by reserveIndex
   * @param reserveIndex The index of the reserve
   * @return True if the user is borrowing or using the reserve as collateral
   */
  isUsingAsCollateralOrBorrowing(reserveIndex: number): boolean {
    if (reserveIndex >= this.borrowingStatus.length) {
      throw new Error("Invalid reserve index");
    }
    return (
      this.borrowingStatus[reserveIndex] || this.collateralStatus[reserveIndex]
    );
  }

  /**
   * @dev Check if the user is borrowing the reserve identified by reserveIndex
   * @param reserveIndex The index of the reserve
   * @return True if the user is borrowing the reserve
   */
  isBorrowing(reserveIndex: number): boolean {
    if (reserveIndex >= this.borrowingStatus.length) {
      throw new Error("Invalid reserve index");
    }
    return this.borrowingStatus[reserveIndex];
  }

  /**
   * @dev Check if the user is using the reserve as collateral identified by reserveIndex
   * @param reserveIndex The index of the reserve
   * @return True if the user is using the reserve as collateral
   */
  isUsingAsCollateral(reserveIndex: number): boolean {
    if (reserveIndex >= this.collateralStatus.length) {
      throw new Error("Invalid reserve index");
    }
    return this.collateralStatus[reserveIndex];
  }

  /**
   * @dev Check if the user is borrowing from any reserve
   * @return True if the user is borrowing from any reserve
   */
  isBorrowingAny(): boolean {
    return this.borrowingStatus.includes(true);
  }

  /**
   * @dev Check if the user is not using any reserve
   * @return True if the user is not borrowing or using any reserve as collateral
   */
  isEmpty(): boolean {
    return (
      !this.borrowingStatus.includes(true) &&
      !this.collateralStatus.includes(true)
    );
  }
}
