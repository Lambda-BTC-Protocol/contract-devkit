import { z } from "zod";

export const zUtils = {
  bigint: () => z.bigint({ coerce: true }),
};
