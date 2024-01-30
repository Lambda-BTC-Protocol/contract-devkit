import { LRC20Base } from "@/contracts/standards/base/LRC20Base";

export default class Pusd extends LRC20Base {
  constructor() {
    super("Protocol USD", "PUSD", 8, "walletB", 0);
  }
}
