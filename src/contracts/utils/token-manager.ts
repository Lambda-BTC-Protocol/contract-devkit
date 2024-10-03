import { DEPLOY_PREFIX } from "./DEPLOY_PREFIX";

export function getAToken(token: string): string {
  return `${DEPLOY_PREFIX}a${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

export function getATokenName(token: string): string {
  return `a${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

export function getStableDebtTokenName(token: string): string {
  return `${token}-StableDebtToken`;
}

export function getVariableDebtTokenName(token: string): string {
  return `${token}-VariableDebtToken`;
}

export function getRedeployedContractName(contract: string): string {
  return `${DEPLOY_PREFIX}${contract}`;
}
