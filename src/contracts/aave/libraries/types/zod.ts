import { z } from "zod";

export const InitReserveInputSchema = z.object({
  aTokenImpl: z.string(),
  stableDebtTokenImpl: z.string(),
  variableDebtTokenImpl: z.string(),
  underlyingAssetDecimals: z.number(),
  interestRateStrategyAddress: z.string(),
  underlyingAsset: z.string(),
  treasury: z.string(),
  incentivesController: z.string(),
  underlyingAssetName: z.string(),
});

export const reserveConfigSchema = z.object({
  ltv: z.bigint(),
  liquidationThreshold: z.bigint(),
  liquidationBonus: z.bigint(),
  decimals: z.number(),
  reserveFactor: z.bigint(),
  isActive: z.boolean(),
  isFrozen: z.boolean(),
  borrowingEnabled: z.boolean(),
  stableRateBorrowingEnabled: z.boolean(),
});

export type ReserveConfigType = z.infer<typeof reserveConfigSchema>;
