import { bigIntJson } from "@/lib/big-int";

export const apiWrapper = {
  inscribe: (inscription: string, sender: string, block: number) =>
    fetch("/api/inscribe", {
      method: "POST",
      body: JSON.stringify({ inscription, sender, block }),
    }),
  query: (contract: string, func: string, args: unknown[]) => {
    const url = new URL("/api/query", window.location.href);
    url.searchParams.set("contract", contract);
    url.searchParams.set("function", func);
    url.searchParams.set("args", bigIntJson.stringify(args));
    return fetch(url)
      .then((res) => res.text())
      .then((res) => bigIntJson.parse(res));
  },
};
