import { describe, expect, it } from "vitest";

describe("Supabase credentials", () => {
  it.skipIf(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)("can reach Supabase auth and REST endpoints with configured keys", async () => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(url, "SUPABASE_URL must be configured").toBeTruthy();
    expect(anonKey, "SUPABASE_ANON_KEY must be configured").toBeTruthy();
    expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY must be configured").toBeTruthy();

    const baseUrl = new URL(url!).origin;
    const authResponse = await fetch(`${baseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey!}` },
    });
    expect(authResponse.ok, `Supabase auth responded ${authResponse.status}`).toBe(true);

    const restResponse = await fetch(`${baseUrl}/rest/v1/`, {
      headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey!}` },
    });
    expect(restResponse.ok, `Supabase REST responded ${restResponse.status}`).toBe(true);
  }, 15_000);
});
