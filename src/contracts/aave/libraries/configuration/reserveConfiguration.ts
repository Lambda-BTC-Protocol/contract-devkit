import { ReserveConfigType } from "../types/zod";

export class ReserveConfiguration {
  private ltv: bigint;
  private liquidationThreshold: bigint;
  private liquidationBonus: bigint;
  private decimals: number;
  private reserveFactor: bigint;
  private isActive: boolean;
  private isFrozen: boolean;
  private borrowingEnabled: boolean;
  private stableRateBorrowingEnabled: boolean;

  constructor(
    ltv: bigint = 0n,
    liquidationThreshold: bigint = 0n,
    liquidationBonus: bigint = 0n,
    decimals: number = 0,
    reserveFactor: bigint = 0n,
    isActive: boolean = true,
    isFrozen: boolean = false,
    borrowingEnabled: boolean = true,
    stableRateBorrowingEnabled: boolean = false
  ) {
    this.ltv = ltv;
    this.liquidationThreshold = liquidationThreshold;
    this.liquidationBonus = liquidationBonus;
    this.decimals = decimals;
    this.reserveFactor = reserveFactor;
    this.isActive = isActive;
    this.isFrozen = isFrozen;
    this.borrowingEnabled = borrowingEnabled;
    this.stableRateBorrowingEnabled = stableRateBorrowingEnabled;
  }

  public setConfiguration(config: ReserveConfigType): void {
    this.ltv = config.ltv;
    this.liquidationThreshold = config.liquidationThreshold;
    this.liquidationBonus = config.liquidationBonus;
    this.decimals = config.decimals;
    this.reserveFactor = config.reserveFactor;
    this.isActive = config.isActive;
    this.isFrozen = config.isFrozen;
    this.borrowingEnabled = config.borrowingEnabled;
    this.stableRateBorrowingEnabled = config.stableRateBorrowingEnabled;
  }

  // Setters

  public setLtv(ltv: bigint): void {
    if (ltv > 65535n) {
      throw new Error("Invalid LTV");
    }
    this.ltv = ltv;
  }

  public setLiquidationThreshold(threshold: bigint): void {
    if (threshold > 65535n) {
      throw new Error("Invalid liquidation threshold");
    }
    this.liquidationThreshold = threshold;
  }

  public setLiquidationBonus(bonus: bigint): void {
    if (bonus > 65535n) {
      throw new Error("Invalid liquidation bonus");
    }
    this.liquidationBonus = bonus;
  }

  public setDecimals(decimals: number): void {
    if (decimals > 255) {
      throw new Error("Invalid decimals");
    }
    this.decimals = decimals;
  }

  public setActive(active: boolean): void {
    this.isActive = active;
  }

  public setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
  }

  public setBorrowingEnabled(enabled: boolean): void {
    this.borrowingEnabled = enabled;
  }

  public setStableRateBorrowingEnabled(enabled: boolean): void {
    this.stableRateBorrowingEnabled = enabled;
  }

  public setReserveFactor(reserveFactor: bigint): void {
    if (reserveFactor > 65535) {
      throw new Error("Invalid reserve factor");
    }
    this.reserveFactor = reserveFactor;
  }

  // Getters

  public getLtv(): bigint {
    return this.ltv;
  }

  public getLiquidationThreshold(): bigint {
    return this.liquidationThreshold;
  }

  public getLiquidationBonus(): bigint {
    return this.liquidationBonus;
  }

  public getDecimals(): number {
    return this.decimals;
  }

  public getActive(): boolean {
    return this.isActive;
  }

  public getFrozen(): boolean {
    return this.isFrozen;
  }

  public getBorrowingEnabled(): boolean {
    return this.borrowingEnabled;
  }

  public getStableRateBorrowingEnabled(): boolean {
    return this.stableRateBorrowingEnabled;
  }

  public getReserveFactor(): bigint {
    return this.reserveFactor;
  }

  // GetFlags method: Bundles the boolean flags together
  public getFlags(): {
    isActive: boolean;
    isFrozen: boolean;
    borrowingEnabled: boolean;
    stableRateBorrowingEnabled: boolean;
  } {
    return {
      isActive: this.getActive(),
      isFrozen: this.getFrozen(),
      borrowingEnabled: this.getBorrowingEnabled(),
      stableRateBorrowingEnabled: this.getStableRateBorrowingEnabled(),
    };
  }

  // GetParams method: Returns the main configuration parameters
  public getParams(): {
    ltv: bigint;
    liquidationThreshold: bigint;
    liquidationBonus: bigint;
    decimals: number;
    reserveFactor: bigint;
  } {
    return {
      ltv: this.getLtv(),
      liquidationThreshold: this.getLiquidationThreshold(),
      liquidationBonus: this.getLiquidationBonus(),
      decimals: this.getDecimals(),
      reserveFactor: this.getReserveFactor(),
    };
  }
}
