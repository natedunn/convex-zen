import { query } from "./_generated/server";

export * from "./auth/core";
export * from "./auth/admin";

export const hello = query({
  args: {},
  handler: async () => {
    return "hello";
  },
});
