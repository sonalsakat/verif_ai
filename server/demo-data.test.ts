import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { appRouter } from "./routers";
import { ensureWorkspaceForUser, query } from "./postgres";
import { getSupabaseAuthUser } from "./supabase";
import { ensureDemoWorkspace } from "./demo-data";

const hasConfiguredSupabase = ["DATABASE_URL", "SUPABASE_DB_URL", "SUPABASE_POSTGRES_URL", "SUPABASE_URL"].some((key) => Boolean(process.env[key]));
const suite = describe.skipIf(hasConfiguredSupabase);

suite("SIH 2026 demo procurement fixtures", () => {
  it("seeds all three fictional scenarios, exposes source-level PROVE IT evidence, and replays without duplication", async () => {
    const authUser = await getSupabaseAuthUser("demo-officer-token");
    expect(authUser).not.toBeNull();
    const demoOfficer = await ensureWorkspaceForUser(authUser!);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: demoOfficer });
    const snapshot = await caller.workspace.snapshot();
    expect(snapshot.tenders).toHaveLength(3);
    expect(snapshot.bidders).toHaveLength(9);
    for (const tender of snapshot.tenders) expect(tender.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    for (const bidder of snapshot.bidders) expect(bidder.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(snapshot.requirements).toHaveLength(9);
    expect(snapshot.checks).toHaveLength(27);
    expect(snapshot.tenders.every((tender) => String(tender.externalId).startsWith("DEMO-SIH26-") && tender.isDemo)).toBe(true);
    expect(snapshot.documents.every((document) => String(document.fileName).startsWith("SAMPLE-") && document.process === "Processed")).toBe(true);

    for (const tender of snapshot.tenders) {
      const tenderChecks = snapshot.checks.filter((check) => check.tenderId === tender.id);
      expect(new Set(tenderChecks.map((check) => check.bidderId)).size).toBe(3);
      expect(tenderChecks.some((check) => check.result === "Verified")).toBe(true);
      expect(tenderChecks.some((check) => check.result === "Needs Review")).toBe(true);
      expect(tenderChecks.some((check) => check.result === "Pending Verification")).toBe(true);
    }

    const mismatch = snapshot.checks.find((check) => check.result === "Needs Review" && String(check.tenderTitle).includes("Digital Radiography"));
    expect(mismatch).toBeDefined();
    expect(String(mismatch?.claim)).toContain("₹11.20 Cr");
    const mismatchEvidence = mismatch?.evidenceRecords as Array<Record<string, unknown>>;
    expect(mismatchEvidence).toHaveLength(2);
    expect(mismatchEvidence.map((item) => String(item.extracted)).join(" ")).toContain("₹11.20 Cr");
    expect(mismatchEvidence.map((item) => String(item.extracted)).join(" ")).toContain("₹8.70 Cr");
    expect(mismatchEvidence.map((item) => String(item.page)).sort()).toEqual(["2", "6"]);

    const pendingBidder = snapshot.bidders.find((bidder) => bidder.status === "Pending Verification");
    expect(pendingBidder).toBeDefined();
    const pendingChecks = snapshot.checks.filter((check) => check.bidderId === pendingBidder?.id);
    expect(pendingChecks.some((check) => check.result === "Pending Verification")).toBe(true);
    expect(pendingChecks.some((check) => check.result === "Non-Compliant")).toBe(false);
    expect(pendingBidder?.status).toBe("Pending Verification");
    const pendingCheck = pendingChecks.find((check) => check.result === "Pending Verification");
    const pendingEvidence = pendingCheck?.evidenceRecords as Array<Record<string, unknown>>;
    expect(pendingEvidence.some((item) => String(item.sourceStatus).includes("SANDBOX UNAVAILABLE"))).toBe(true);
    expect(pendingEvidence.some((item) => Boolean(item.documentId))).toBe(true);

    expect(snapshot.checks.every((check) => /^sha256:[a-f0-9]{64}$/.test(String(check.sha256Hash)))).toBe(true);

    const beforeReplayAudit = snapshot.auditEvents.length;
    const replay = await caller.workspace.runVerification({ tenderId: String(mismatch?.tenderId), bidderId: String(mismatch?.bidderId) });
    expect(replay.message).toContain("No live government lookup was made");
    const afterReplay = await caller.workspace.snapshot();
    expect(afterReplay.checks).toHaveLength(27);
    expect(afterReplay.auditEvents.length).toBeGreaterThan(beforeReplayAudit);

    const decisionComment = "SAMPLE SIH review: turnover discrepancy requires officer clarification.";
    const decision = await caller.workspace.recordDecision({
      tenderId: String(mismatch?.tenderId),
      bidderId: String(mismatch?.bidderId),
      decision: "Needs Clarification",
      comment: decisionComment,
    });
    expect(decision.decision).toBe("Needs Clarification");
    const afterDecision = await caller.workspace.snapshot();
    expect(afterDecision.decisions.some((row) => row.comment === decisionComment)).toBe(true);
    expect(afterDecision.auditEvents.some((row) => row.action === "Officer recorded formal qualification decision")).toBe(true);

    const createdTender = await caller.workspace.createTender({
      title: "Protected route workflow sample tender",
      department: "SIH Demonstration Procurement Desk",
      description: "Created only to exercise the existing demo API workflow.",
      submissionDeadline: "2026-12-31",
      bidOpeningDate: "2027-01-05",
      estimatedValue: "1000000",
    });
    expect(createdTender.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const createdBidder = await caller.workspace.createBidder({
      name: "Workflow Test Supplier Ltd.",
      registrationId: "DEMO-WORKFLOW-001",
      gstin: "27AABCT1234C1Z5",
      pan: "AABCT1234C",
      tenderId: String(createdTender.id),
    });
    expect(createdBidder.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const createdRequirement = await caller.workspace.addRequirement({
      tenderId: String(createdTender.id),
      title: "Audited turnover documentation",
      category: "Financial",
      evidenceRequired: "Three-year audited financial statements",
    });
    expect(createdRequirement.tenderId).toBe(createdTender.id);
    expect(createdRequirement.source).toBe("Officer added");

    const existingOrganizationId = randomUUID();
    await query(
      `insert into public.tenders (organization_id, external_id, title, department, description, estimated_value)
       values ($1, $2, $3, $4, $5, $6)`,
      [existingOrganizationId, "PROCUREMENT-EXISTING-001", "Existing procurement record", "Existing department", "Do not overwrite or mix sample fixtures into this workspace.", "1000000"],
    );
    await ensureDemoWorkspace({ ...demoOfficer, organizationId: existingOrganizationId });
    const untouched = await query<{ externalId: string }>(
      `select external_id as "externalId" from public.tenders where organization_id = $1`,
      [existingOrganizationId],
    );
    expect(untouched.rows).toHaveLength(1);
    expect(untouched.rows[0]?.externalId).toBe("PROCUREMENT-EXISTING-001");
  });
});
