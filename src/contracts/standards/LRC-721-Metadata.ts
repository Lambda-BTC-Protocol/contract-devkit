// *** LRC721+Metadata TOKEN STANDARD ***
// *** QUERIES ***
// name() returns string
// symbol() returns string
// tokenURI(tokenId: string) returns string
// balanceOf(owner: string) returns number
// ownerOf(tokenId: number) returns string
// getApproved(tokenId: number) returns string
// isApprovedForAll(owner: string, operator: string) returns boolean

// *** MUTATIONS ***
// transfer(to: string, tokenId: number)
// transferFrom(from: string, to: string, tokenId: number)
// approve(approved: string, tokenId: number)
// setApprovalForAll(operator: string, approved: boolean)

// *** EVENTS ***
// Transfer(from, to, tokenId)
// Approval(owner, approved, tokenId);
// ApprovalForAll(owner, operator, approved);

import { ContractParams } from "@/contracts/types/contract";

export interface LRC721Metadata {
  name(params: ContractParams): string | Promise<string>;
  symbol(params: ContractParams): string | Promise<string>;
  tokenURI(params: ContractParams): string | Promise<string>;
  balanceOf(params: ContractParams): number | Promise<number>;
  ownerOf(
    params: ContractParams,
  ): string | undefined | Promise<string | undefined>;
  getApproved(
    params: ContractParams,
  ): string | undefined | Promise<string | undefined>;
  isApprovedForAll(params: ContractParams): boolean | Promise<boolean>;

  transfer(params: ContractParams): void | Promise<void>;
  transferFrom(params: ContractParams): void | Promise<void>;
  approve(params: ContractParams): void | Promise<void>;
  setApprovalForAll(params: ContractParams): void | Promise<void>;
}
