import { ContractParams } from "./types/contract";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing";
import { persistenceStorage } from "../persistenceStorage";
import aToken, { aToken as aTokenTemplate } from "./aToken";
import { Ecosystem } from "./types/ecosystem";
import { getAToken, getATokenName } from "./utils/token-manager";

export default class TokenManager {
  activeOn = 100;
  private tokenList = new Set<string>();
  private availableTokens = new Set<string>();
  private admin: string;

  constructor() {
    this.admin = "walletA";
  }

  /**
   * Only whitelisted users can call this functiontokenManager
   * @param user - User to check
   * @throws Error if user is not whitelisted
   * @returns void
   */

  private onlyWhitelisted(user: string): void {
    const whitelisted = [this.admin];
    if (!whitelisted.includes(user)) {
      throw new Error(`Caller is not admin`);
    }
  }

  /**
   * Check if token already exists
   * @param token - Token to check
   * @throws Error if token already exists
   * @returns void
   */

  private async atokenNotExists(token: string): Promise<void> {
    if (this.tokenList.has(getAToken(token))) {
      throw new Error(`Token ${getAToken(token)} already exists`);
    }
  }

  private async tokenExists(
    ecosystem: Ecosystem,
    token: string
  ): Promise<void> {
    let tokenContract;
    try {
      tokenContract = await ecosystem.getContractObj<aTokenTemplate>(
        getAToken(token)
      );
    } catch (e) {
      console.log(e, "ERROR");
    } finally {
      if (!tokenContract) {
        throw new Error(`Token ${token} does not exist`);
      }
    }
  }

  /**
   * Add a token to the list of valid tokens
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @param eventLogger - Event logger
   * @returns void
   */

  public async addToken({
    ecosystem,
    metadata,
    args,
    eventLogger,
  }: ContractParams): Promise<void> {
    const schema = z.tuple([z.string(), z.string()]);
    const [token, symbol] = argsParsing(schema, args, "addToken");
    const formattedToken = getAToken(token);
    const aTokenName = getATokenName(token)
    this.onlyWhitelisted(metadata.sender);
    this.atokenNotExists(token);
    this.tokenExists(ecosystem, token);
    console.log(formattedToken, "capitalizeFirstLetter(token)");
    try {
      const res = await ecosystem.redeployContract("aToken", aTokenName);
      const aTokenInstance = await ecosystem.getContractObj<aToken>(formattedToken);
      if(!aTokenInstance) {
        return
      }
      await aTokenInstance.init([formattedToken, formattedToken, 0n]);

      console.log(res, 'redeploy')
    } catch (e) {
      console.log(e, 'redeploy error');
    }

    // persistenceStorage[`a${token}`] = new aTokenTemplate(`a${token}`, `a${symbol}`);

    this.tokenList.add(formattedToken);
    this.availableTokens.add(token);
  }

  /**
   * Remove a token from the list of valid tokens
   * @param metadata - Metadata of the contract
   * @param args - Arguments for the contract
   * @returns void
   */

  public removeToken({ metadata, args }: ContractParams): void {
    const schema = z.tuple([z.string()]);
    const [token] = argsParsing(schema, args, "removeToken");

    this.onlyWhitelisted(metadata.sender);

    this.tokenList.delete(getAToken(token));
    this.availableTokens.delete(token);
  }

  /**
   * Get the list of valid tokens
   * @returns string[] - List of valid tokens
   */

  public getTokens(): string[] {
    console.log(JSON.stringify(this.tokenList));
    return Array.from(this.tokenList);
  }

  public getAvaibleTokens(): string[] {
    console.log(JSON.stringify(this.availableTokens));
    return Array.from(this.availableTokens);
  }

  public get tokensCount(): number {
    return this.tokenList.size;
  }
}
