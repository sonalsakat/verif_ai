import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { ensureWorkspaceForUser } from "../postgres";
import { getSupabaseAuthUser, type AppUser } from "../supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AppUser | null;
};

function getBearerToken(req: CreateExpressContextOptions["req"]): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AppUser | null = null;
  const accessToken = getBearerToken(opts.req);
  if (accessToken) {
    try {
      const authUser = await getSupabaseAuthUser(accessToken);
      if (authUser) user = await ensureWorkspaceForUser(authUser);
    } catch (error) {
      console.warn("[Supabase Auth] Failed to authenticate request:", error instanceof Error ? error.message : error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
