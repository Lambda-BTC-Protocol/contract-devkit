import { LRC20Base } from "@/contracts/standards/base/LRC20Base";

export default class Proto extends LRC20Base {
  constructor() {
    super("Proto", "PROTO", 8, "walletA", 0);
  }
}
