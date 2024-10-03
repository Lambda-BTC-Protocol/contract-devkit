import { Inscription } from "@/inscription";

const mockFundsInscriptions = [
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "bitcoin",
      function: "mint",
      args: ["walletA", "1000000000000"],
    } satisfies Inscription),
    sender: "protocol",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "bitcoin",
      function: "mint",
      args: ["walletB", "100000000000000"],
    } satisfies Inscription),
    sender: "protocol",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "mint",
      args: ["100000000000000000"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "transfer",
      args: ["walletB", "50000000000000000"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "pusd",
      function: "mint",
      args: ["1000000000000000000"],
    } satisfies Inscription),
    sender: "walletB",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "pusd",
      function: "transfer",
      args: ["walletA", "900000000000000000"],
    } satisfies Inscription),
    sender: "walletB",
  },
];

const approveInscriptions = [
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "pusd",
      function: "approve",
      args: ["uniV2Router", "10000000000000000"],
    } satisfies Inscription),
    sender: "walletA", // mock funds
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "approve",
      args: ["uniV2Router", "10000000000000"],
    } satisfies Inscription),
    sender: "walletA", // mock funds
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "bitcoin",
      function: "approve",
      args: ["uniV2Router", "10000000000000"],
    } satisfies Inscription),
    sender: "walletA", // mock funds
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "approve",
      args: ["lendingPool", "10000000000000000"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "bitcoin",
      function: "approve",
      args: ["lendingPool", "1000000000"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "bitcoin",
      function: "approve",
      args: ["lendingPool", "10000000000000"],
    } satisfies Inscription),
    sender: "walletB", // mock funds
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "approve",
      args: ["lendingPool", "10000000000000"],
    } satisfies Inscription),
    sender: "walletB", // mock funds
  },
];

const initInscriptions = [
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingRateOracle",
      function: "init",
      args: [],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "oracle",
      function: "init",
      args: ["uniV2Router", "uniV2Factory"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "uniV2Router",
      function: "init",
      args: ["uniV2Factory"],
    } satisfies Inscription),
    sender: "walletA",
  },
];

const initV2ReservesInscriptions = [
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "uniV2Router",
      function: "addLiquidity",
      args: ["proto", "pusd", 3703700, 100, 0, 0, "walletA", 1000000000000],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "uniV2Router",
      function: "addLiquidity",
      args: [
        "bitcoin",
        "pusd",
        10000,
        639000000,
        0,
        0,
        "walletA",
        1000000000000,
      ],
    } satisfies Inscription),
    sender: "walletA",
  },
];

const lendingPoolConfigurationInscriptions = [
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPoolConfigurator",
      function: "batchInitReserve",
      args: [
        [
          {
            aTokenImpl: "aToken",
            stableDebtTokenImpl: "stableDebtToken",
            variableDebtTokenImpl: "variableDebtToken",
            underlyingAssetDecimals: 8,
            interestRateStrategyAddress: "defaultReserveInterestRateStrategy",
            underlyingAsset: "proto",
            treasury: "walletB",
            incentivesController: "",
            underlyingAssetName: "proto",
          },
        ],
      ],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPoolConfigurator",
      function: "configureReserveAsCollateral",
      args: ["proto", "6000", "7000", "11500"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPoolConfigurator",
      function: "setReserveFactor",
      args: ["proto", "9900"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPoolConfigurator",
      function: "batchInitReserve",
      args: [
        [
          {
            aTokenImpl: "aToken",
            stableDebtTokenImpl: "stableDebtToken",
            variableDebtTokenImpl: "variableDebtToken",
            underlyingAssetDecimals: 8,
            interestRateStrategyAddress: "defaultReserveInterestRateStrategy",
            underlyingAsset: "bitcoin",
            treasury: "walletB",
            incentivesController: "",
            underlyingAssetName: "bitcoin",
          },
        ],
      ],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPoolConfigurator",
      function: "configureReserveAsCollateral",
      args: ["bitcoin", "6000", "7000", "11500"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPoolConfigurator",
      function: "setReserveFactor",
      args: ["bitcoin", "9900"],
    } satisfies Inscription),
    sender: "walletA",
  },
];

const depositInscriptions = [
  // NOTE: In this case "walletB" makes a "proto" deposit and "walletA" makes a "bitcoin" deposit.This allows walletA to borrow proto.
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPool",
      function: "deposit",
      args: ["proto", "10000000000", "walletB"],
    } satisfies Inscription),
    sender: "walletB",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "lendingPool",
      function: "deposit",
      args: ["bitcoin", "100000000", "walletA"],
    } satisfies Inscription),
    sender: "walletA",
  },
  // NOTE: In this case "walletB" makes a "bitcoin" deposit and "walletA" makes a proto deposit.This allows walletA to borrow bitcoin.
  // {
  //   inscription: JSON.stringify({
  //     p: "lam",
  //     op: "call",
  //     contract: "lendingPool",
  //     function: "deposit",
  //     args: ["bitcoin", "100000", "walletB"],
  //   } satisfies Inscription),
  //   sender: "walletB",
  // },
  // {
  //   inscription: JSON.stringify({
  //     p: "lam",
  //     op: "call",
  //     contract: "lendingPool",
  //     function: "deposit",
  //     args: ["proto", "100000000", "walletA"],
  //   } satisfies Inscription),
  //   sender: "walletA",
  // },
];

export const initialInscriptions = [
  ...mockFundsInscriptions,
  ...initInscriptions,
  ...approveInscriptions,
  ...initV2ReservesInscriptions,
  ...lendingPoolConfigurationInscriptions,
  ...depositInscriptions,
];
