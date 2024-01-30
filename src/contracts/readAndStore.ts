import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { Contract, ContractParams } from "@/contracts/types/contract";

export default class ReadAndStore implements Contract {
  activeOn = 1;
  message = new Map<string, string>();

  store = ({ metadata, eventLogger, args }: ContractParams) => {
    const schema = z.tuple([z.string()]);
    const [valueToStore] = argsParsing(schema, args, "save");

    this.message.set(metadata.sender, valueToStore);

    eventLogger.log({
      type: "SAVE",
      message: `${valueToStore} stored for ${metadata.sender}`,
    });
  };

  async storeClassMethod({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [valueToStore] = argsParsing(schema, args, "save");

    this.message.set(metadata.sender, valueToStore);

    eventLogger.log({
      type: "SAVE",
      message: `${valueToStore} stored for ${metadata.sender}`,
    });
  }

  read = ({ args }: ContractParams) => {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "read");
    return this.message.get(from) ?? "";
  };
}
