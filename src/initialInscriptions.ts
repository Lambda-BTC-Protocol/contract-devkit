import { Inscription } from "@/inscription";

export const initialInscriptions = [
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "mint",
      args: ["100000000"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "proto",
      function: "approve",
      args: ["move", "1"],
    } satisfies Inscription),
    sender: "walletA",
  },
  {
    inscription: JSON.stringify({
      p: "lam",
      op: "call",
      contract: "move",
      function: "moveFrom",
      args: ["walletA", "proto"],
    } satisfies Inscription),
    sender: "walletB",
  },
];
