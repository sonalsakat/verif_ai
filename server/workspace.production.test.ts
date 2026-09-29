import { describe, expect, it } from "vitest";
import { query } from "./postgres";

describe("production workspace schema", () => {
  it("contains the organization-scoped procurement tables", async () => {
    const result = await query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[]) order by table_name`,
      [["profiles", "organizations", "organization_members", "tenders", "tender_requirements", "bidders", "bids", "documents", "document_extractions", "compliance_checks", "evidence", "contradictions", "government_sources", "audit_events", "officer_decisions", "reports"]],
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      "audit_events",
      "bidders",
      "bids",
      "compliance_checks",
      "contradictions",
      "document_extractions",
      "documents",
      "evidence",
      "government_sources",
      "officer_decisions",
      "organization_members",
      "organizations",
      "profiles",
      "reports",
      "tender_requirements",
      "tenders",
    ]);
  });
});
