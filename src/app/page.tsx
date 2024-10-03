"use client";

import { useForm } from "react-hook-form";
import { persistenceStorage } from "@/persistenceStorage";
import { Button } from "@/components/ui/button";
import { apiWrapper } from "@/lib/api-wrapper";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { bigIntJson } from "@/lib/big-int";
import { toast } from "sonner";
import { initialInscriptions } from "@/initialInscriptions";

export default function Home() {
  const { register, handleSubmit } = useForm({
    defaultValues: { inscription: "", wallet: "walletA", block: 100 },
  });

  const queryForm = useForm({
    defaultValues: {
      contract: "bitcoin",
      function: "balanceOf",
      args: '["walletA"]',
    },
  });

  const [queryResult, setQueryResult] = useState("");

  const onSubmit = async (data: {
    inscription: string;
    wallet: string;
    block: number;
  }) => {
    await apiWrapper.inscribe(data.inscription, data.wallet, data.block);
    toast.success("Inscribed");
  };

  const onQuerySubmit = async (data: {
    contract: string;
    function: string;
    args: string | string[]; // Allow either a string or an array of strings
  }) => {
    let parsedArgs: unknown[];

    if (Array.isArray(data.args)) {
      parsedArgs = JSON.parse(JSON.stringify(data.args)); // Parse array of strings directly
    } else {
      // Handle the case where args is a single string
      try {
        parsedArgs = JSON.parse(data.args); // Attempt to parse as a JSON array
        // If successful, the `args` was a stringified array
      } catch (e) {
        // If parsing fails, assume `args` is a single string value
        parsedArgs = [data.args]; // Wrap it in an array
      }
    }
    const result = await apiWrapper.query(
      data.contract,
      data.function,
      parsedArgs
    );
    console.log(result);
    setQueryResult(bigIntJson.stringify(result));
  };

  const inscribeInitial = async () => {
    for (const initialInscription of initialInscriptions) {
      await apiWrapper.inscribe(
        initialInscription.inscription,
        initialInscription.sender,
        100
      );
    }
    toast.success("Inscribed");
  };

  return (
    <main className="grid grid-cols-2 gap-8">
      <section className="overflow-hidden">
        <h2 className="text-3xl">Inscribe</h2>
        <p>Available contracts: {Object.keys(persistenceStorage).join(", ")}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <textarea
            {...register("inscription")}
            className="border rounded p-2"
          />
          <div className="flex gap-2 items-end">
            <div className="flex-grow">
              <Label>Wallet</Label>
              <Input {...register("wallet", { required: true })} />
            </div>
            <div className="">
              <Label>Block</Label>
              <Input
                {...register("block", { required: true, valueAsNumber: true })}
              />
            </div>
            <Button>Inscribe</Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => inscribeInitial()}
            >
              Inscribe Initial
            </Button>
          </div>
        </form>
        <h3 className="text-xl mt-2">Examples</h3>
        <p>{`{ "p": "lam", "op": "call", "contract": "bitcoin", "function": "mint", "args": [ "walletA", "100000000" ] } - sender: protocol`}</p>
        <p>{`{ "p": "lam", "op": "call", "contract": "proto", "function": "mint", "args": [ "100000000" ] } - sender: walletA`}</p>
        <p>{`{ "p": "lam", "op": "call", "contract": "bitcoin", "function": "approve", "args": [ "uniV2Router", "1000000000" ] } - sender: walletA`}</p>
        <p>{`{ "p": "lam", "op": "call", "contract": "lendingPool", "function": "deposit", "args": ["bitcoin", "100000000", "walletA"] }  - sender: walletA`}</p>
        <p>{`{ "p": "lam", "op": "call", "contract": "lendingPool", "function": "borrow", "args": [ "proto", "100000", 1, "walletA" ] } - sender: walletA`}</p>
        <p>{`{ "p": "lam", "op": "call", "contract": "lendingPool", "function": "repay", "args": [ "proto", "100000", 1, "walletA" ] } - sender: walletA`}</p>
        <p>{`{ "p": "lam", "op": "call", "contract": "lendingPool", "function": "withdraw", "args": [ "bitcoin",  "50000000", "walletA" ] } - sender: walletA`}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-3xl">Query</h2>
        <form
          onSubmit={queryForm.handleSubmit(onQuerySubmit)}
          className="grid grid-cols-3 gap-2"
        >
          <div>
            <Label>Contract</Label>
            <Input {...queryForm.register("contract")} />
          </div>
          <div>
            <Label>Function</Label>
            <Input {...queryForm.register("function")} />
          </div>
          <div>
            <Label>Args</Label>
            <Input {...queryForm.register("args")} />
          </div>
          <Button size="sm" className="w-fit">
            Query
          </Button>
        </form>
        <p className="text-lg">result: {queryResult}</p>
      </section>
    </main>
  );
}
