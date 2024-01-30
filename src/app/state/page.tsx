import { persistenceStorage } from "@/persistenceStorage";
import { stringify } from "superjson";
import { Contract } from "@/contracts/types/contract";
import { createStrippedState } from "@/lib/stripped-contract-state";

export const dynamic = "force-dynamic";

const Page = () => {
  const toString = (contract: Contract) => {
    return stringify(createStrippedState(contract));
  };

  return (
    <div className="mx-auto max-w-full">
      {Object.entries(persistenceStorage).map(([name, state]) => (
        <div key={name}>
          <h3 className="text-lg">{name}</h3>
          <pre>{toString(state)}</pre>
        </div>
      ))}
    </div>
  );
};

export default Page;
