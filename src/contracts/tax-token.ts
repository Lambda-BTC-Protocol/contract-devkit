import { Contract, ContractParams } from "@/contracts/types/contract";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";

export default class TaxToken implements Contract {
  activeOn = 50;
  _balance = new Map<string, bigint>();
  _totalSupply = 0n;

  // mint -> fairmint
  mint({ metadata, eventLogger }: ContractParams) {
    const mintAmount = metadata.timestamp % 1000; // last 3 digits
    const newBalance =
      (this._balance.get(metadata.sender) ?? 0n) + BigInt(mintAmount);
    this._balance.set(metadata.sender, newBalance);
    this._totalSupply += BigInt(mintAmount);

    eventLogger.log({
      type: "MINT",
      message: `${metadata.sender} got ${mintAmount}`,
    });
  }

  // transfer -> tax

  // balance
  balance({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "balance");

    return this._balance.get(from) ?? 0n;
  }
}
