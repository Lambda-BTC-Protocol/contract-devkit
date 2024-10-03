import { Contract, ContractParams } from "./types/contract";
import UniV2Router from "./uniV2Router";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing";
import { ExecutionError } from "./types/execution-error";
import UniV2Pair from "./uniV2Pair";
import UniV2Factory from "./uniV2Factory";
import { LRC20Base } from "./standards/base/LRC20Base";
import { loadContract } from "@/lib/utils";
import { EventTypes } from "./aave/libraries/types/dataTypes";

export default class Oracle implements Contract {
  activeOn = 100;
  private _isInitialized = false;
  private _router: string = "";
  private _factory: string = "";
  private _pusd: string = "pusd";

  constructor() {}

  init({ args, eventLogger }: ContractParams): void {
    if (this._isInitialized) {
      throw new ExecutionError("Oracle already initialized");
    }
    const schema = z.tuple([z.string(), z.string()]);
    const [router, factory] = argsParsing(schema, args, "init");
    this._router = router;
    this._factory = factory;
    this._isInitialized = true;

    eventLogger.log({
      type: EventTypes.INITIALIZED,
      message: `Oracle initialized with router: ${this._router}, factory: ${this._factory}`,
    });
  }

  /// @notice Gets an asset price by address
  /// @param asset The asset address
  async getAssetPrice({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<bigint> {
    const schema = z.tuple([z.string()]);
    const [tokenA] = argsParsing(schema, args, "getAssetPrice");

    // Get the router contract
    const routerContract = await loadContract<UniV2Router>(
      ecosystem,
      this._router
    );

    // Determine token0 and token1 to get the right order in the pair
    const [token0, token1] =
      tokenA < this._pusd ? [tokenA, this._pusd] : [this._pusd, tokenA];

    // Get the factory contract and retrieve the pair address
    const factoryContract = await loadContract<UniV2Factory>(
      ecosystem,
      this._factory
    );

    const pairAddress = await factoryContract.getPairAddress([token0, token1]);
    if (!pairAddress) {
      throw new ExecutionError(
        "UniswapV2Router: Cannot find the pair contract"
      );
    }

    // Get the pair contract
    const pairContract = await loadContract<UniV2Pair>(ecosystem, pairAddress);

    // Get reserves of the pair
    const [reserve0, reserve1] = await pairContract.getReserves([]);
    let reserveA, reserveB;

    if (token0 === this._pusd) {
      [reserveA, reserveB] = [reserve1, reserve0];
    } else {
      [reserveA, reserveB] = [reserve0, reserve1];
    }

    // Get the token contract to fetch decimals
    const tokenContract = await loadContract<LRC20Base>(ecosystem, tokenA);

    const decimals = await tokenContract?.decimals([]);

    if (!decimals) {
      throw new ExecutionError(
        "UniswapV2Router: Cannot retrieve token decimals"
      );
    }

    // Calculate the token price in PUSD using the reserves
    const price = await routerContract?.quote([
      10n ** BigInt(decimals),
      reserveA,
      reserveB,
    ]);

    return price ?? 0n;
  }
}
