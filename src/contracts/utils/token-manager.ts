import { DEPLOY_PREFIX } from "./DEPLOY_PREFIX";

export function getAToken(token: string): string {
  return `${DEPLOY_PREFIX}a${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

export function getATokenName(token: string): string {
  return `a${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}
