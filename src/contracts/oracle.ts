import { Contract, ContractParams } from "./types/contract";
import UniV2Router from "./uniV2Router";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing";
import { ExecutionError } from "./types/execution-error";
import UniV2Pair from "./uniV2Pair";
import UniV2Factory from "./uniV2Factory";
import { LRC20Base } from "./standards/base/LRC20Base";


export default class Oracle implements Contract {
  activeOn = 100;
  private router: string;
  private factory: string;
  private pusd: string = "pusd";
  constructor(router: string, factory: string) {
    this.router = router;
    this.factory = factory;
  }

  async getAssetPrice({
    metadata,
    args,
    eventLogger,
    ecosystem,
  }: ContractParams): Promise<bigint | null> {
    // const asset = args.args[0][0];
    const routerContract = await ecosystem.getContractObj<UniV2Router>(
      this.router
    );
    const schema = z.tuple([z.string()]);
    const [tokenA] = argsParsing(schema, args, "getAssetPrice");
    const [token0, token1] =
      tokenA < this.pusd ? [tokenA, this.pusd] : [this.pusd, tokenA];

    const factoryContract = await ecosystem.getContractObj<UniV2Factory>(
      this.factory
    );
    if (!factoryContract) {
      throw new ExecutionError("UniswapV2Router: Cannot get factory contract");
    }
    let pair = await factoryContract.getPairAddress([token0, token1]);
    if (!pair)
      throw new ExecutionError("UniswapV2Router: Cannot get pair contract");

    const pairContract = await ecosystem.getContractObj<UniV2Pair>(pair);

    if (!pairContract)
      throw new ExecutionError("UniswapV2Router: Cannot get pair contract");
    let reserveA, reserveB;
    if(token0 != 'pusd'){
      [reserveA, reserveB] = await pairContract.getReserves([]);
    }else{
      [reserveB, reserveA] = await pairContract.getReserves([]);
    }
    const tokenContract = await ecosystem.getContractObj<LRC20Base>(tokenA);
    const decimals = await tokenContract?.decimals([])
    if (!decimals)
      throw new ExecutionError("UniswapV2Router: Cannot get pair contract");
    const price = await routerContract?.quote([10**decimals, reserveA, reserveB])
    if(!price){
      return null
    }
    return price;
  }

}
