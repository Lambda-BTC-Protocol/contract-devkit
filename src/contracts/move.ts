import { Contract, ContractParams } from "@/contracts/types/contract";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { TokenHelper } from "@/contracts/utils/token-helper";

export default class Move implements Contract {
  activeOn = 0;

  async moveFrom({ args, ecosystem, metadata }: ContractParams) {
    console.log("move", metadata);
    const schema = z.tuple([z.string(), z.string()]);
    const [from, contract] = argsParsing(schema, args, "moveFrom");
    const token = new TokenHelper(contract, ecosystem);
    await token.transferFrom(from, metadata.sender, 1n);
  }
}
