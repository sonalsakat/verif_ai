import { describe, expect, it } from "vitest";

describe("Gemini credentials", () => {
  it.skipIf(!process.env.GEMINI_API_KEY)("can list available models with the configured key", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be configured").toBeTruthy();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key!)}`);
    expect(response.ok, `Gemini responded ${response.status}`).toBe(true);
    const body = (await response.json()) as { models?: unknown[] };
    expect(Array.isArray(body.models)).toBe(true);
  }, 15_000);
});
