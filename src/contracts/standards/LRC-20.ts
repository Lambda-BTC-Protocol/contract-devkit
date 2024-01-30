// *** LRC20 TOKEN STANDARD ***
// *** QUERIES ***
// name() returns string
// symbol() returns string
// decimals() returns number
// totalSupply() returns number
// balanceOf(owner: string) returns number
// allowance(owner: string, spender: string) returns number

// *** MUTATIONS ***
// transfer(to: string, value: number)
// transferFrom(from: string, to: string, value: number)
// approve(spender: string, value: number)

// *** EVENTS ***
// Transfer(from, to, value)
// Approval(owner, spender, value);

import { ContractParams } from "@/contracts/types/contract";

export interface LRC20 {
  name(params: ContractParams): string | Promise<string>;
  symbol(params: ContractParams): string | Promise<string>;
  decimals(params: ContractParams): number | Promise<number>;
  totalSupply(params: ContractParams): bigint | Promise<bigint>;
  balanceOf(params: ContractParams): bigint | Promise<bigint>;
  allowance(params: ContractParams): bigint | Promise<bigint>;

  transfer(params: ContractParams): void | Promise<void>;
  transferFrom(params: ContractParams): void | Promise<void>;
  approve(params: ContractParams): void | Promise<void>;
}
