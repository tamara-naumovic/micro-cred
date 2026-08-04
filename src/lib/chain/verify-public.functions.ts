// Thin server-function wrapper. All runtime logic lives in verify-public.server.ts
// so that server-fn splitting cannot strip sibling helpers.
import { createServerFn } from "@tanstack/react-start";

export const verifyPublicCredentialOnChain = createServerFn({ method: "POST" })
  .inputValidator((d: { shareToken: string }) => {
    if (!d || typeof d.shareToken !== "string" || d.shareToken.length < 6) {
      throw new Error("Invalid input");
    }
    return { shareToken: d.shareToken };
  })
  .handler(async ({ data }) => {
    const { runPublicChainVerification } = await import("./verify-public.server");
    return runPublicChainVerification(data.shareToken);
  });
