import { Contract } from "./types/contract";
interface IPriceOracle {
  getMarketBorrowRate(asset: string): number;
  setMarketBorrowRate(asset: string, rate: number, sender: string): void;
}

class PriceOracle implements IPriceOracle, Contract {
  activeOn = 100;
  private _borrowRates: Map<string, number> = new Map();
  private _owner: string;
  private _currentSender: string | null = null;
  constructor(owner: string) {
    this._owner = owner;
  }

  getMarketBorrowRate(asset: string): number {
    return this._borrowRates.get(asset) || 0;
  }

  setMarketBorrowRate(asset: string, rate: number, sender: string): void {
    if (sender !== this._owner) {
      throw new Error("Ownable: caller is not the owner");
    }
    this._borrowRates.set(asset, rate);
  }
}
export default PriceOracle;
