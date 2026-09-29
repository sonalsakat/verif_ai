import { describe, expect, it } from "vitest";
import { Client } from "pg";

describe("Supabase PostgreSQL connection", () => {
  it.skipIf(!process.env.SUPABASE_DB_URL)("can execute a lightweight query", async () => {
    const connectionString = process.env.SUPABASE_DB_URL;
    expect(connectionString, "SUPABASE_DB_URL must be configured").toBeTruthy();

    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    try {
      const result = await client.query<{ ok: number }>("select 1 as ok");
      expect(result.rows[0]?.ok).toBe(1);
    } finally {
      await client.end();
    }
  }, 20_000);
});
