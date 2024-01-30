import { z } from "zod";
import { ExecutionError } from "@/contracts/types/execution-error";

export const argsParsing = <T>(
  schema: z.Schema<T>,
  args: unknown[],
  functionName: string,
): z.infer<typeof schema> => {
  const result = schema.safeParse(args);
  if (!result.success)
    throw new ExecutionError(`${functionName}: args parsing error`);
  return result.data as z.infer<typeof schema>;
};
