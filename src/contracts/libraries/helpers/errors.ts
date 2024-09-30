// Errors.ts

export class Errors {
    // Common errors
    static readonly CALLER_NOT_POOL_ADMIN = '33'; // 'The caller must be the pool admin'
    static readonly BORROW_ALLOWANCE_NOT_ENOUGH = '59'; // User borrows on behalf, but allowance are too small
  
    // Contract specific errors
    static readonly VL_INVALID_AMOUNT = '1'; // 'Amount must be greater than 0'
    static readonly VL_NO_ACTIVE_RESERVE = '2'; // 'Action requires an active reserve'
    static readonly VL_RESERVE_FROZEN = '3'; // 'Action cannot be performed because the reserve is frozen'
    static readonly VL_CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH = '4'; // 'The current liquidity is not enough'
    static readonly VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE = '5'; // 'User cannot withdraw more than the available balance'
    static readonly VL_TRANSFER_NOT_ALLOWED = '6'; // 'Transfer cannot be allowed.'
    static readonly VL_BORROWING_NOT_ENABLED = '7'; // 'Borrowing is not enabled'
    static readonly VL_INVALID_INTEREST_RATE_MODE_SELECTED = '8'; // 'Invalid interest rate mode selected'
    static readonly VL_COLLATERAL_BALANCE_IS_0 = '9'; // 'The collateral balance is 0'
    static readonly VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '10'; // 'Health factor is lesser than the liquidation threshold'
    static readonly VL_COLLATERAL_CANNOT_COVER_NEW_BORROW = '11'; // 'There is not enough collateral to cover a new borrow'
    static readonly VL_STABLE_BORROWING_NOT_ENABLED = '12'; // 'Stable borrowing not enabled'
    static readonly VL_COLLATERAL_SAME_AS_BORROWING_CURRENCY = '13'; // 'Collateral is (mostly) the same currency that is being borrowed'
    static readonly VL_AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE = '14'; // 'The requested amount is greater than the max loan size in stable rate mode'
    static readonly VL_NO_DEBT_OF_SELECTED_TYPE = '15'; // 'For repayment of stable debt, the user needs to have stable debt, otherwise, he needs to have variable debt'
    static readonly VL_NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF = '16'; // 'To repay on behalf of a user, an explicit amount to repay is needed'
    static readonly VL_NO_STABLE_RATE_LOAN_IN_RESERVE = '17'; // 'User does not have a stable rate loan in progress on this reserve'
    static readonly VL_NO_VARIABLE_RATE_LOAN_IN_RESERVE = '18'; // 'User does not have a variable rate loan in progress on this reserve'
    static readonly VL_UNDERLYING_BALANCE_NOT_GREATER_THAN_0 = '19'; // 'The underlying balance needs to be greater than 0'
    static readonly VL_DEPOSIT_ALREADY_IN_USE = '20'; // 'User deposit is already being used as collateral'
    static readonly LP_NOT_ENOUGH_STABLE_BORROW_BALANCE = '21'; // 'User does not have any stable rate loan for this reserve'
    static readonly LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET = '22'; // 'Interest rate rebalance conditions were not met'
    static readonly LP_LIQUIDATION_CALL_FAILED = '23'; // 'Liquidation call failed'
    static readonly LP_NOT_ENOUGH_LIQUIDITY_TO_BORROW = '24'; // 'There is not enough liquidity available to borrow'
    static readonly LP_REQUESTED_AMOUNT_TOO_SMALL = '25'; // 'The requested amount is too small for a FlashLoan.'
    static readonly LP_INCONSISTENT_PROTOCOL_ACTUAL_BALANCE = '26'; // 'The actual balance of the protocol is inconsistent'
    static readonly LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR = '27'; // 'The caller of the function is not the lending pool configurator'
    static readonly LP_INCONSISTENT_FLASHLOAN_PARAMS = '28'; // 'Inconsistent flashloan parameters'
    static readonly CT_CALLER_MUST_BE_LENDING_POOL = '29'; // 'The caller of this function must be a lending pool'
    static readonly CT_CANNOT_GIVE_ALLOWANCE_TO_HIMSELF = '30'; // 'User cannot give allowance to himself'
    static readonly CT_TRANSFER_AMOUNT_NOT_GT_0 = '31'; // 'Transferred amount needs to be greater than zero'
    static readonly RL_RESERVE_ALREADY_INITIALIZED = '32'; // 'Reserve has already been initialized'
    static readonly LPC_RESERVE_LIQUIDITY_NOT_0 = '34'; // 'The liquidity of the reserve needs to be 0'
    static readonly LPC_INVALID_ATOKEN_POOL_ADDRESS = '35'; // 'The liquidity of the reserve needs to be 0'
    static readonly LPC_INVALID_STABLE_DEBT_TOKEN_POOL_ADDRESS = '36'; // 'The liquidity of the reserve needs to be 0'
    static readonly LPC_INVALID_VARIABLE_DEBT_TOKEN_POOL_ADDRESS = '37'; // 'The liquidity of the reserve needs to be 0'
    static readonly LPC_INVALID_STABLE_DEBT_TOKEN_UNDERLYING_ADDRESS = '38'; // 'The liquidity of the reserve needs to be 0'
    static readonly LPC_INVALID_VARIABLE_DEBT_TOKEN_UNDERLYING_ADDRESS = '39'; // 'The liquidity of the reserve needs to be 0'
    static readonly LPC_INVALID_ADDRESSES_PROVIDER_ID = '40'; // 'The liquidity of the reserve needs to be 0'
    static readonly LPC_INVALID_CONFIGURATION = '75'; // 'Invalid risk parameters for the reserve'
    static readonly LPC_CALLER_NOT_EMERGENCY_ADMIN = '76'; // 'The caller must be the emergency admin'
    static readonly LPAPR_PROVIDER_NOT_REGISTERED = '41'; // 'Provider is not registered'
    static readonly LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD = '42'; // 'Health factor is not below the threshold'
    static readonly LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED = '43'; // 'The collateral chosen cannot be liquidated'
    static readonly LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER = '44'; // 'User did not borrow the specified currency'
    static readonly LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE = '45'; // "There isn't enough liquidity available to liquidate"
    static readonly LPCM_NO_ERRORS = '46'; // 'No errors'
    static readonly LP_INVALID_FLASHLOAN_MODE = '47'; // 'Invalid flashloan mode selected'
    static readonly MATH_MULTIPLICATION_OVERFLOW = '48';
    static readonly MATH_ADDITION_OVERFLOW = '49';
    static readonly MATH_DIVISION_BY_ZERO = '50';
    static readonly RL_LIQUIDITY_INDEX_OVERFLOW = '51'; // 'Liquidity index overflows uint128'
    static readonly RL_VARIABLE_BORROW_INDEX_OVERFLOW = '52'; // 'Variable borrow index overflows uint128'
    static readonly RL_LIQUIDITY_RATE_OVERFLOW = '53'; // 'Liquidity rate overflows uint128'
    static readonly RL_VARIABLE_BORROW_RATE_OVERFLOW = '54'; // 'Variable borrow rate overflows uint128'
    static readonly RL_STABLE_BORROW_RATE_OVERFLOW = '55'; // 'Stable borrow rate overflows uint128'
    static readonly CT_INVALID_MINT_AMOUNT = '56'; // 'Invalid amount to mint'
    static readonly LP_FAILED_REPAY_WITH_COLLATERAL = '57';
    static readonly CT_INVALID_BURN_AMOUNT = '58'; // 'Invalid amount to burn'
    static readonly LP_FAILED_COLLATERAL_SWAP = '60';
    static readonly LP_INVALID_EQUAL_ASSETS_TO_SWAP = '61';
    static readonly LP_REENTRANCY_NOT_ALLOWED = '62';
    static readonly LP_CALLER_MUST_BE_AN_ATOKEN = '63';
    static readonly LP_IS_PAUSED = '64'; // 'Pool is paused'
    static readonly LP_NO_MORE_RESERVES_ALLOWED = '65';
    static readonly LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN = '66';
    static readonly RC_INVALID_LTV = '67';
    static readonly RC_INVALID_LIQ_THRESHOLD = '68';
    static readonly RC_INVALID_LIQ_BONUS = '69';
    static readonly RC_INVALID_DECIMALS = '70';
    static readonly RC_INVALID_RESERVE_FACTOR = '71';
    static readonly LPAPR_INVALID_ADDRESSES_PROVIDER_ID = '72';
    static readonly VL_INCONSISTENT_FLASHLOAN_PARAMS = '73';
    static readonly LP_INCONSISTENT_PARAMS_LENGTH = '74';
    static readonly UL_INVALID_INDEX = '77';
    static readonly LP_NOT_CONTRACT = '78';
    static readonly SDT_STABLE_DEBT_OVERFLOW = '79';
    static readonly SDT_BURN_EXCEEDS_BALANCE = '80';
  }
  
  export enum CollateralManagerErrors {
    NO_ERROR,
    NO_COLLATERAL_AVAILABLE,
    COLLATERAL_CANNOT_BE_LIQUIDATED,
    CURRENCY_NOT_BORROWED,
    HEALTH_FACTOR_ABOVE_THRESHOLD,
    NOT_ENOUGH_LIQUIDITY,
    NO_ACTIVE_RESERVE,
    HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD,
    INVALID_EQUAL_ASSETS_TO_SWAP,
    FROZEN_RESERVE,
  }
  