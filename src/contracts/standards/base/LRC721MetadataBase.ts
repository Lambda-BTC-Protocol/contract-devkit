import { ExecutionError } from "@/contracts/types/execution-error";
import { EventLogger } from "@/contracts/types/event-logger";
import { Metadata } from "@/contracts/types/metadata";
import { z } from "zod";
import { argsParsing } from "@/contracts/utils/args-parsing";
import { Contract, ContractParams } from "@/contracts/types/contract";
import { ExtendedMap } from "@/contracts/utils/extended-map";
import { LRC721Metadata } from "@/contracts/standards/LRC-721-Metadata";

export class LRC721MetadataBase implements Contract, LRC721Metadata {
  activeOn = 0;

  private _currentTokenId = 0;
  private _tokenHolder = new ExtendedMap<number, string>();
  private _approvedFor = new ExtendedMap<number, string>();
  private _walletApprovedAll = new ExtendedMap<string, Map<string, boolean>>(); // owner -> operator -> approved

  constructor(
    private _name: string,
    private _symbol: string,
    private _baseUrl: string,
  ) {}

  // *** MUTATIONS ***

  async mint({ metadata, eventLogger }: ContractParams) {
    await this._mintLogic(metadata, eventLogger);
  }

  async transfer({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string(), z.number()]);
    const [to, tokenId] = argsParsing(schema, args, "transfer");

    const currentHolder = this._tokenHolder.get(tokenId);
    if (!currentHolder) {
      throw new ExecutionError("transfer: tokenId does not have a holder");
    }
    if (currentHolder !== metadata.sender) {
      throw new ExecutionError("transfer: token is not owned by sender");
    }

    await this._transferLogic(metadata.sender, to, tokenId, eventLogger);
  }

  async transferFrom({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), z.string(), z.number()]);
    const [from, to, tokenId] = argsParsing(schema, args, "transferFrom");

    const approvedAddress = this._approvedFor.get(tokenId);
    const approvedAllForMap =
      this._walletApprovedAll.get(from) ?? new Map<string, boolean>();

    const approvedAllForSender =
      approvedAllForMap.get(metadata.sender) ?? false;

    if (metadata.sender !== approvedAddress && !approvedAllForSender) {
      throw new ExecutionError("transferFrom: sender is not approved address");
    }
    await this._transferLogic(from, to, tokenId, eventLogger);
  }

  async approve({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), z.number()]);
    const [approved, tokenId] = argsParsing(schema, args, "approve");

    const holder = this._tokenHolder.get(tokenId);
    if (holder === null || holder !== metadata.sender) {
      throw new ExecutionError(
        "approve: sender is not the holder of the token. Must not approve NFTs of other people",
      );
    }
    this._approvedFor.set(tokenId, approved);

    eventLogger.log({
      type: "APPROVE",
      message: `OWNER: '${metadata.sender}'; TOKENID: '${tokenId}'; APPROVED: ${approved}`,
    });
  }

  async setApprovalForAll({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), z.boolean()]);
    const [operator, approved] = argsParsing(schema, args, "setApprovalForAll");

    this._walletApprovedAll.update(metadata.sender, new Map(), (currentMap) =>
      currentMap.set(operator, approved),
    );

    eventLogger.log({
      type: "APPROVALFORALL",
      message: `OWNER: '${metadata.sender}'; OPERATOR: '${operator}'; APPROVED: ${approved}`,
    });
  }

  // *** QUERIES ***

  name() {
    return this._name;
  }

  symbol() {
    return this._symbol;
  }

  tokenURI({ args }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "tokenUri");

    return `${this._baseUrl}${tokenId}`;
  }

  balanceOf({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "balanceOf");

    return [...this._tokenHolder.values()].filter((t) => t === from).length;
  }

  ownerOf({ args }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "ownerOf");

    return this._tokenHolder.get(tokenId);
  }

  getApproved({ args }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "getApproved");

    return this._approvedFor.get(tokenId);
  }

  async isApprovedForAll({ args }: ContractParams) {
    const schema = z.tuple([z.string(), z.string()]);
    const [owner, operator] = argsParsing(schema, args, "isApprovedForAll");

    return this._walletApprovedAll.get(owner)?.get(operator) ?? false;
  }

  protected async _mintLogic(metadata: Metadata, eventLogger: EventLogger) {
    this._tokenHolder.set(this._currentTokenId, metadata.sender);
    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '0x0'; TO: '${metadata.sender}'; TOKENID: ${this._currentTokenId}`,
    });

    this._currentTokenId++;
  }

  protected async _transferLogic(
    from: string,
    to: string,
    tokenId: number,
    eventLogger: EventLogger,
  ) {
    // update holder of the token
    this._tokenHolder.set(tokenId, to);

    // reset approved flag
    this._approvedFor.delete(tokenId);

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '${from}'; TO: '${to}'; TOKENID: ${tokenId}`,
    });
  }
}
