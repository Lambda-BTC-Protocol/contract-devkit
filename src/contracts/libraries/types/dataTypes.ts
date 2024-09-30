// SPDX-License-Identifier: agpl-3.0

// Import necessary types
export type Address = string;

interface ReserveData {
    // Stores the reserve configuration
    configuration: ReserveConfigurationMap;
    // The liquidity index. Expressed in ray
    liquidityIndex: bigint; // Use bigint for uint128
    // Variable borrow index. Expressed in ray
    variableBorrowIndex: bigint; // Use bigint for uint128
    // The current supply rate. Expressed in ray
    currentLiquidityRate: bigint; // Use bigint for uint128
    // The current variable borrow rate. Expressed in ray
    currentVariableBorrowRate: bigint; // Use bigint for uint128
    // The current stable borrow rate. Expressed in ray
    currentStableBorrowRate: bigint; // Use bigint for uint128
    // Last update timestamp
    lastUpdateTimestamp: number; // Use number for uint40
    // Token addresses
    aTokenAddress: Address;
    stableDebtTokenAddress: Address;
    variableDebtTokenAddress: Address;
    // Address of the interest rate strategy
    interestRateStrategyAddress: Address;
    // The id of the reserve. Represents the position in the list of the active reserves
    id: number; // Use number for uint8
}

interface ReserveConfigurationMap {
    // Bit 0-15: LTV
    // Bit 16-31: Liquidation threshold
    // Bit 32-47: Liquidation bonus
    // Bit 48-55: Decimals
    // Bit 56: Reserve is active
    // Bit 57: Reserve is frozen
    // Bit 58: Borrowing is enabled
    // Bit 59: Stable rate borrowing enabled
    // Bit 60-63: Reserved
    // Bit 64-79: Reserve factor
    data: bigint; // Use bigint for uint256
}

interface UserConfigurationMap {
    data: bigint; // Use bigint for uint256
}

enum InterestRateMode {
    NONE,
    STABLE,
    VARIABLE,
}

// Exporting types for external use
export { InterestRateMode }; export type { ReserveData, ReserveConfigurationMap, UserConfigurationMap };

