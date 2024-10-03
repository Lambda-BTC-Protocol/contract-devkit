import { ExecutionError } from "@/contracts/types/execution-error";
import { EventLogger } from "@/contracts/types/event-logger";
import { LRC20Base } from "@/contracts/standards/base/LRC20Base";
import { Metadata } from "@/contracts/types/metadata";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { ContractParams } from "@/contracts/types/contract";
import { zUtils } from "@/contracts/utils/zod";

export default class Bitcoin extends LRC20Base {
  _protocolWallet = "protocol";

  constructor() {
    super("Protocol Bitcoin", "PBTC", 8, "protocol", 0);
  }

  payProtocolFees({ eventLogger, metadata, args }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [from, fees] = argsParsing(schema, args, "payProtocolFees");

    if (metadata.sender !== this._protocolWallet) {
      throw new ExecutionError(
        "payProtocolFees: only protocol wallet can do this",
      );
    }
    const fromBefore = this._balance.get(from) ?? 0n;
    if (fromBefore < fees)
      throw new ExecutionError("payProtocolFees: not enough balance");

    this._balance.set(from, fromBefore - fees);

    const protocolWalletBefore = this._balance.get(this._protocolWallet) ?? 0n;
    this._balance.set(this._protocolWallet, protocolWalletBefore + fees);

    eventLogger.log({
      type: "PROTOCOL FEES",
      message: `${from} paid ${fees}`,
    });
  }

  protected async mintLogic(
    args: unknown[],
    metadata: Metadata,
    eventLogger: EventLogger,
  ) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [to, amount] = argsParsing(schema, args, "mint");

    if (metadata.sender !== this._protocolWallet)
      throw new ExecutionError(
        "mint: only the protocol wallet can mint bitcoin",
      );

    this._balance.update(to, 0n, (balance) => balance + amount);
    this._totalSupply += amount;

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '0x0'; TO: '${to}'; VALUE: ${amount}`,
    });
  }
}
