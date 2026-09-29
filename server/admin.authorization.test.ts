import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(portalRole: "admin" | "procurement_officer"): TrpcContext {
  const now = new Date();
  return {
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      openId: "00000000-0000-0000-0000-000000000001",
      name: "Test User",
      email: "test@example.gov",
      role: portalRole === "admin" ? "admin" : "user",
      portalRole,
      profileRole: portalRole === "admin" ? "administrator" : "officer",
      organizationId: "00000000-0000-0000-0000-000000000002",
      organizationName: "Test Organization",
    },
  };
}

describe("admin authorization", () => {
  it("rejects procurement officers before running admin procedures", async () => {
    const caller = appRouter.createCaller(context("procurement_officer"));
    await expect(caller.admin.overview()).rejects.toMatchObject<TRPCError>({ code: "FORBIDDEN" });
  });

  it("exposes the admin portal boundary only to admin users", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.overview()).resolves.toMatchObject({ cards: expect.any(Object), health: expect.any(Object) });
  });
});
