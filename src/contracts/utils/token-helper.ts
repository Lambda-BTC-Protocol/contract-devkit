import { LRC20Base } from "@/contracts/standards/base/LRC20Base";
import { ExecutionError } from "@/contracts/types/execution-error";
import { Ecosystem } from "@/contracts/types/ecosystem";

/**
 * Helper class for interacting with LRC20 tokens.
 */
export class TokenHelper {
  constructor(
    private contract: string,
    private ecosystem: Ecosystem,
  ) {}

  async transfer(to: string, value: bigint) {
    const token = await this.ecosystem.getContractObj<LRC20Base>(this.contract);
    if (!token) throw new ExecutionError(`Contract ${this.contract} not found`);

    await token.transfer([to, value]);
  }

  async transferFrom(from: string, to: string, value: bigint) {
    const token = await this.ecosystem.getContractObj<LRC20Base>(this.contract);
    if (!token) throw new ExecutionError(`Contract ${this.contract} not found`);

    await token.transferFrom([from, to, value]);
  }

  async balanceOf(wallet: string) {
    const token = await this.ecosystem.getContractObj<LRC20Base>(this.contract);
    if (!token) throw new ExecutionError(`Contract ${this.contract} not found`);

    return token.balanceOf([wallet]);
  }
}
