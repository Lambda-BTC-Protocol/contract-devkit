import { Inscription } from "@/inscription";
import { sendError } from "next/dist/server/api-utils";

export const initialInscriptions = [
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "bitcoin",
      function: "mint",
      args: ["walletA", "100000000"],
    } satisfies Inscription),
    sender: "protocol", // mock funds
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "mint",
      args: ["100000000"],
    } satisfies Inscription),
    sender: "walletA", // mock funds
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "approve",
      args: ["pool", "1000000000"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "tokenManager",
      function: "addToken",
      args: ["proto", "1000000000"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "pool",
      function: "deposit",
      args: ["proto", "10000", "walletA"],
    } satisfies Inscription),
    sender: "walletA",
  },
];
