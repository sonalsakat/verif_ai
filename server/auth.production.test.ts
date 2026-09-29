import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("production authentication", () => {
  it("exposes the configured Supabase auth client settings without a demo mode", async () => {
    const caller = appRouter.createCaller(publicContext());
    const config = await caller.auth.config();
    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("your-project") && process.env.SUPABASE_URL.startsWith("http")) {
      expect(config.url).toMatch(/^https:\/\//);
      expect(config.anonKey.length).toBeGreaterThan(20);
    } else {
      expect(config.url).toBeTruthy();
    }
  });

  it("rejects workspace access without a Supabase session", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.workspace.snapshot()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("supports an idempotent client-side logout contract", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.auth.logout()).resolves.toEqual({ success: true });
  });
});
