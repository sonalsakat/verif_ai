import { createHash, randomUUID } from "node:crypto";
import { query, recordAudit } from "./postgres";
import type { AppUser } from "./supabase";
import { getConnectorRegistry } from "./connectors";
import { ensureDemoWorkspace } from "./demo-data";

export type WorkspaceSnapshot = {
  organization: { id: string; name: string };
  tenders: Array<Record<string, unknown>>;
  bidders: Array<Record<string, unknown>>;
  requirements: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  checks: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  stats: {
    activeTenders: number;
    biddersUnderReview: number;
    verified: number;
    needsReview: number;
    nonCompliant: number;
    pendingDocuments: number;
  };
};

function int(value: unknown): number {
  return Number(value ?? 0);
}

export async function getWorkspaceSnapshot(user: AppUser): Promise<WorkspaceSnapshot> {
  await ensureDemoWorkspace(user);
  const [tenders, bidders, requirements, documents, checks, evidence, auditEvents, decisions, sources] = await Promise.all([
    query(`select t.id, t.external_id as "externalId", t.external_id like 'DEMO-SIH26-%' as "isDemo", t.title, t.department, t.description,
      to_char(t.submission_deadline, 'DD Mon YYYY') as closing, t.submission_deadline as "submissionDeadline",
      t.bid_opening_date as "bidOpeningDate", coalesce(t.estimated_value, 0)::text as value, t.status, t.progress,
      (select count(*) from public.bids b where b.tender_id = t.id)::int as bidders,
      (select count(*) from public.compliance_checks cc where cc.tender_id = t.id and cc.result = 'Verified')::int as verified,
      (select count(*) from public.compliance_checks cc where cc.tender_id = t.id and cc.result = 'Needs Review')::int as review,
      t.created_at as "createdAt", t.updated_at as "updatedAt"
      from public.tenders t where t.organization_id = $1 order by t.created_at desc`, [user.organizationId]),
    query(`select b.id, b.name, b.registration_id as registration, b.registration_id like 'DEMO-SIH26-%' as "isDemo", b.gstin, b.pan, b.status,
      b.compliance_score as compliance, b.risk, b.last_checked as "lastChecked", b.created_at as "createdAt",
      coalesce((select count(*) from public.documents d where d.bidder_id = b.id), 0)::int as "documentCount",
      coalesce((select count(*) from public.compliance_checks cc where cc.bidder_id = b.id and cc.result = 'Verified'), 0)::int as "verifiedChecks",
      coalesce((select count(*) from public.compliance_checks cc where cc.bidder_id = b.id), 0)::int as "totalChecks"
      from public.bidders b where b.organization_id = $1 order by b.created_at desc`, [user.organizationId]),
    query(`select r.id, r.tender_id as "tenderId", r.title, r.category, r.evidence_required as evidence,
      r.source, r.status, r.created_at as "createdAt" from public.tender_requirements r
      join public.tenders t on t.id = r.tender_id where t.organization_id = $1 order by r.created_at`, [user.organizationId]),
    query(`select d.id, d.tender_id as "tenderId", d.bidder_id as "bidderId", d.file_key as "fileKey",
      d.file_name as file, d.file_name as "fileName", d.mime_type as "mimeType", d.size_bytes as size,
      d.document_type as type, d.processing_status as process, d.verification_status as status,
      d.extracted_text as "extractedText", d.extraction, d.uploaded_at as uploaded, d.processed_at as processed
      from public.documents d where d.organization_id = $1 order by d.uploaded_at desc`, [user.organizationId]),
    query(`select cc.id, cc.tender_id as "tenderId", cc.bidder_id as "bidderId", cc.requirement_id as "requirementId",
      cc.requirement, cc.evidence, cc.evidence as claim, coalesce(e.source, cc.source) as source,
      (t.external_id like 'DEMO-SIH26-%' or b.registration_id like 'DEMO-SIH26-%') as "isDemo",
      cc.result, cc.confidence, cc.detail, cc.rule, cc.checked_at as checked, r.evidence_required as "evidenceRequired",
      t.title as "tenderTitle", b.name as "bidderName",
      e.document_id as "documentId", coalesce(e.document_name, '—') as document, coalesce(e.page_number, '—') as page,
      coalesce(e.extracted_value, '') as extracted, coalesce(e.relevant_evidence, '') as "relevantEvidence",
      coalesce(e.source_status, cc.source) as "sourceStatus", coalesce(e.confidence, cc.confidence) as "evidenceConfidence"
      from public.compliance_checks cc join public.tenders t on t.id = cc.tender_id join public.bidders b on b.id = cc.bidder_id
      left join public.tender_requirements r on r.id = cc.requirement_id left join lateral (
        select * from public.evidence e0 where e0.check_id = cc.id order by (e0.document_id is not null) desc, e0.created_at desc limit 1
      ) e on true where cc.organization_id = $1 order by cc.checked_at desc`, [user.organizationId]),
    query(`select e.id, e.check_id as "checkId", e.document_id as "documentId", e.source, e.document_name as document,
      e.page_number as page, e.extracted_value as extracted, e.relevant_evidence as evidence,
      e.verification_date as verified, e.source_status as "sourceStatus", e.confidence from public.evidence e
      join public.compliance_checks cc on cc.id = e.check_id where cc.organization_id = $1 order by e.created_at desc`, [user.organizationId]),
    query(`select ae.id, to_char(ae.created_at at time zone 'Asia/Kolkata', 'HH24:MI') as time,
      ae.action, ae.entity, coalesce(p.full_name, 'System') as user, ae.status, ae.metadata,
      case when ae.status ilike '%review%' or ae.status ilike '%pending%' then 'orange'
           when ae.status ilike '%verified%' or ae.status ilike '%qualified%' then 'green'
           when ae.status ilike '%viewed%' then 'gray' else 'blue' end as tone
      from public.audit_events ae left join public.profiles p on p.id = ae.user_id
      where ae.organization_id = $1 order by ae.created_at desc limit 100`, [user.organizationId]),
    query(`select od.id, od.tender_id as "tenderId", od.bidder_id as "bidderId", od.decision, od.comment,
      od.created_at as "createdAt", coalesce(p.full_name, 'Officer') as officer
      from public.officer_decisions od left join public.profiles p on p.id = od.officer_id
      where od.organization_id = $1 order by od.created_at desc`, [user.organizationId]),
    getConnectorRegistry(user.organizationId),
  ]);

  const tenderRows = tenders.rows as Array<Record<string, unknown>>;
  const bidderRows = bidders.rows as Array<Record<string, unknown>>;
  const documentRows = documents.rows as Array<Record<string, unknown>>;
  const checkRows = checks.rows as Array<Record<string, unknown>>;
  const evidenceRows = evidence.rows as Array<Record<string, unknown>>;
  const mappedTenders = tenderRows.map((row) => ({ ...row, bidders: int(row.bidders), verified: int(row.verified), review: int(row.review) }));
  const mappedBidders = bidderRows.map((row) => ({ ...row, documents: `${int(row.documentCount)} / ${Math.max(int(row.totalChecks), 1)}`, lastChecked: row.lastChecked ? new Date(String(row.lastChecked)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Active (Sandbox)" }));
  const mappedDocuments = documentRows.map((row) => ({ ...row, date: row.uploaded ? new Date(String(row.uploaded)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—" }));
  const mappedChecks = checkRows.map((row) => {
    const evidenceRecords = evidenceRows.filter((item) => String(item.checkId) === String(row.id));
    const primaryDocument = evidenceRecords.find((item) => Boolean(item.documentId));
    const claim = String(row.claim || row.evidence || "No bidder claim recorded");
    const fingerprintPayload = {
      checkId: row.id, tenderId: row.tenderId, bidderId: row.bidderId,
      requirement: row.requirement, claim, rule: row.rule, result: row.result,
      evidence: evidenceRecords.map((item) => ({ source: item.source, documentId: item.documentId, document: item.document, page: item.page, extracted: item.extracted, evidence: item.evidence, sourceStatus: item.sourceStatus, confidence: item.confidence })),
    };
    const sha256Hash = `sha256:${createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex")}`;
    return {
      ...row,
      source: evidenceRecords.map((item) => String(item.source || "")).filter(Boolean).join(" ↔ ") || row.source,
      documentId: primaryDocument?.documentId ?? row.documentId,
      document: primaryDocument?.document ?? row.document,
      page: primaryDocument?.page ?? row.page ?? "1",
      extracted: primaryDocument?.extracted ?? row.extracted ?? "",
      relevantEvidence: primaryDocument?.evidence ?? row.relevantEvidence ?? "",
      sourceStatus: primaryDocument?.sourceStatus ?? row.sourceStatus,
      evidenceConfidence: primaryDocument?.confidence ?? row.evidenceConfidence ?? row.confidence,
      evidenceRecords,
      checked: row.checked ? new Date(String(row.checked)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—",
      claim,
      sha256Hash,
    };
  });
  const mappedAudit = auditEvents.rows;

  return {
    organization: { id: user.organizationId, name: user.organizationName },
    tenders: mappedTenders,
    bidders: mappedBidders,
    requirements: requirements.rows,
    documents: mappedDocuments,
    checks: mappedChecks,
    evidence: evidenceRows,
    auditEvents: mappedAudit,
    decisions: decisions.rows,
    sources: sources.rows,
    stats: {
      activeTenders: tenderRows.filter((row) => ["Ready for Decision", "Under Verification", "Documents Pending"].includes(String(row.status))).length,
      biddersUnderReview: bidderRows.filter((row) => row.status === "Needs Review").length,
      verified: bidderRows.filter((row) => row.status === "Verified").length,
      needsReview: bidderRows.filter((row) => row.status === "Needs Review").length,
      nonCompliant: bidderRows.filter((row) => row.status === "Non-Compliant").length,
      pendingDocuments: documentRows.filter((row) => row.status === "Pending" || row.process !== "Processed").length,
    },
  };
}

export async function createTender(user: AppUser, input: { title: string; department: string; description?: string; submissionDeadline?: string; bidOpeningDate?: string; estimatedValue?: string }) {
  const externalId = `GEM/${new Date().getFullYear()}/B/${Math.floor(100000 + Math.random() * 899999)}`;
  const result = await query(`insert into public.tenders (organization_id, external_id, title, department, description, submission_deadline, bid_opening_date, estimated_value, created_by)
    values ($1, $2, $3, $4, $5, nullif($6, '')::date, nullif($7, '')::date, nullif($8, '')::numeric, $9)
    returning id, external_id as "externalId", title, department, description, submission_deadline as "submissionDeadline", bid_opening_date as "bidOpeningDate", estimated_value::text as value, status, progress`,
    [user.organizationId, externalId, input.title, input.department, input.description ?? null, input.submissionDeadline ?? "", input.bidOpeningDate ?? "", input.estimatedValue?.replace(/[₹,\sA-Za-z]/g, "") || "0", user.id]);
  const tender = result.rows[0];
  await recordAudit(user, "Officer created procurement tender", externalId, "Draft", { tenderId: tender.id });
  return tender;
}

export async function createBidder(user: AppUser, input: { name: string; registrationId: string; gstin?: string; pan?: string; tenderId?: string }) {
  const result = await query(`insert into public.bidders (organization_id, name, registration_id, gstin, pan)
    values ($1, $2, $3, nullif($4, ''), nullif($5, ''))
    returning id, name, registration_id as registration, gstin, pan, status, compliance_score as compliance, risk`,
    [user.organizationId, input.name, input.registrationId, input.gstin ?? "", input.pan ?? ""]);
  const bidder = result.rows[0];
  if (input.tenderId) {
    await query(`insert into public.bids (tender_id, bidder_id, status) select $1, $2, 'Under Verification' where exists (select 1 from public.tenders where id = $1 and organization_id = $3) on conflict do nothing`, [input.tenderId, bidder.id, user.organizationId]);
  }
  await recordAudit(user, "Officer registered bidder for verification", input.name, "Completed", { bidderId: bidder.id });
  return bidder;
}

export async function createRequirement(user: AppUser, input: { tenderId: string; title: string; category: string; evidenceRequired: string }) {
  const result = await query(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source)
    select $1, $2, $3, $4, 'Officer added' where exists (select 1 from public.tenders where id = $1 and organization_id = $5)
    returning id, tender_id as "tenderId", title, category, evidence_required as evidence, source, status`, [input.tenderId, input.title, input.category, input.evidenceRequired, user.organizationId]);
  if (!result.rows[0]) throw new Error("Tender not found in this organization");
  await recordAudit(user, "Officer added compliance requirement", input.title, "Completed", { tenderId: input.tenderId });
  return result.rows[0];
}

export async function recordOfficerDecision(user: AppUser, input: { tenderId: string; bidderId: string; decision: "Qualified" | "Not Qualified" | "Needs Clarification"; comment: string }) {
  const result = await query(`insert into public.officer_decisions (organization_id, tender_id, bidder_id, decision, comment, officer_id)
    select $1, $2, $3, $4, $5, $6 where exists (select 1 from public.bidders where id = $3 and organization_id = $1)
    returning id, decision, comment, created_at as "createdAt"`, [user.organizationId, input.tenderId, input.bidderId, input.decision, input.comment, user.id]);
  if (!result.rows[0]) throw new Error("Bidder not found in this organization");
  await query(`update public.bidders set status = case when $1 = 'Qualified' then 'Verified' when $1 = 'Not Qualified' then 'Non-Compliant' else 'Needs Review' end, updated_at = now() where id = $2 and organization_id = $3`, [input.decision, input.bidderId, user.organizationId]);
  await recordAudit(user, "Officer recorded formal qualification decision", input.decision, input.decision, { tenderId: input.tenderId, bidderId: input.bidderId });
  return { ...result.rows[0], auditId: randomUUID() };
}

export async function runVerification(user: AppUser, input: { tenderId: string; bidderId: string }) {
  const [organizationTenders, organizationBidders] = await Promise.all([
    query<{ id: string; externalId?: string }>(`select id, external_id as "externalId" from public.tenders where organization_id = $1 and id = $2`, [user.organizationId, input.tenderId]),
    query<{ id: string; registration?: string }>(`select id, registration_id as registration from public.bidders where organization_id = $1 and id = $2`, [user.organizationId, input.bidderId]),
  ]);
  const demoTender = organizationTenders.rows.find((row) => String(row.id) === input.tenderId && String(row.externalId ?? "").startsWith("DEMO-SIH26-"));
  const demoBidder = organizationBidders.rows.find((row) => String(row.id) === input.bidderId && String(row.registration ?? "").startsWith("DEMO-SIH26-"));
  if (demoTender && demoBidder) {
    const saved = await query<Record<string, unknown>>(
      `select id, tender_id as "tenderId", bidder_id as "bidderId", requirement, evidence as claim, source, result, confidence, detail, rule, checked_at as checked from public.compliance_checks where organization_id = $1 and tender_id = $2 and bidder_id = $3 order by checked_at`,
      [user.organizationId, input.tenderId, input.bidderId],
    );
    const sampleChecks = saved.rows.filter((row) => String(row.tenderId) === input.tenderId && String(row.bidderId) === input.bidderId);
    if (sampleChecks.length) {
      await recordAudit(user, "Officer replayed persisted demo verification evidence", String(demoBidder.registration), "Sandbox Demo", { tenderId: input.tenderId, bidderId: input.bidderId, checks: sampleChecks.length, liveSourceCall: false });
      return { checks: sampleChecks, message: `Replayed ${sampleChecks.length} persisted SAMPLE checks. No live government lookup was made and no adverse finding was inferred.` };
    }
  }

  const requirements = await query<{ id: string; title: string; category: string; evidence_required: string }>(`select r.id, r.title, r.category, r.evidence_required from public.tender_requirements r join public.tenders t on t.id = r.tender_id where r.tender_id = $1 and t.organization_id = $2 order by r.created_at`, [input.tenderId, user.organizationId]);
  const documents = await query<{ id: string; file_name: string; document_type: string; extraction: Record<string, unknown> | null; extracted_text: string | null }>(`select id, file_name, document_type, extraction, extracted_text from public.documents where bidder_id = $1 and organization_id = $2`, [input.bidderId, user.organizationId]);
  if (requirements.rows.length === 0) return { checks: [], message: "No requirements are active for this tender yet." };

  const inserted: Array<Record<string, unknown>> = [];
  for (const requirement of requirements.rows) {
    const linkedSamples = documents.rows.filter((document) => String(document.extraction?.requirementId ?? "") === String(requirement.id));
    const fallbackTerms = `${requirement.title} ${requirement.evidence_required}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4);
    const matchingDocuments = linkedSamples.length ? linkedSamples : documents.rows.filter((document) => fallbackTerms.some((word) => `${document.document_type} ${document.file_name}`.toLowerCase().includes(word)));
    const match = matchingDocuments[0];
    const unavailable = linkedSamples.some((document) => String(document.extraction?.sourceState ?? "").toLowerCase() === "unavailable");
    const comparisonValues = linkedSamples.map((document) => String(document.extraction?.comparedValue ?? "").trim()).filter(Boolean);
    const hasConflict = new Set(comparisonValues).size > 1;
    const result = hasConflict ? "Needs Review" : unavailable ? "Pending Verification" : match ? "Verified" : "Pending";
    const confidence = hasConflict || match ? "High" : "Low";
    const detail = hasConflict
      ? `Conflicting submitted values were found: ${comparisonValues.join(" versus ")}. Both are retained for officer review.`
      : unavailable
        ? `A document is available but its configured sandbox source did not respond. Status remains Pending Verification; unavailability is not non-compliance.`
        : match
          ? `Evidence matched in ${match.file_name}. Deterministic document-to-requirement match; the officer retains final authority.`
          : `No supporting document was found for ${requirement.title}. Evidence is pending; no non-compliant finding is inferred.`;
    const check = await query(`insert into public.compliance_checks (organization_id, tender_id, bidder_id, requirement_id, requirement, evidence, source, result, confidence, detail, rule)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning id, requirement, evidence, source, result, confidence, detail, rule, checked_at as checked`, [user.organizationId, input.tenderId, input.bidderId, requirement.id, requirement.title, match?.file_name ?? "Not submitted", match ? "Submitted document" : "Bidder submissions", result, confidence, detail, `${requirement.title} evidence present`]);
    const row = check.rows[0];
    for (const document of matchingDocuments) {
      const extraction = document.extraction ?? {};
      await query(`insert into public.evidence (check_id, document_id, source, document_name, page_number, extracted_value, relevant_evidence, source_status, confidence) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [row.id, document.id, String(extraction.source || "Bidder-submitted document"), document.file_name, String(extraction.page || "1"), String(extraction.claim || extraction.comparedValue || document.extracted_text?.slice(0, 240) || "Document uploaded and classified"), detail, unavailable ? "SANDBOX UNAVAILABLE · no negative inference" : "Document match · source state recorded", confidence]);
    }
    inserted.push(row);
  }

  await query(`update public.bidders set last_checked = now(), compliance_score = (select coalesce(round(avg(case when result = 'Verified' then 100 when result = 'Needs Review' then 60 else 0 end)), 0)::int from public.compliance_checks where bidder_id = $1), status = case when exists (select 1 from public.compliance_checks where bidder_id = $1 and result = 'Non-Compliant') then 'Non-Compliant' when exists (select 1 from public.compliance_checks where bidder_id = $1 and result = 'Needs Review') then 'Needs Review' when exists (select 1 from public.compliance_checks where bidder_id = $1 and result in ('Pending', 'Pending Verification')) then 'Pending Verification' else 'Verified' end, updated_at = now() where id = $1 and organization_id = $2`, [input.bidderId, user.organizationId]);
  await recordAudit(user, "Rules engine completed automated verification batch", input.bidderId, "Completed", { tenderId: input.tenderId, checkCount: inserted.length });
  return { checks: inserted, message: `${inserted.length} deterministic compliance checks completed successfully.` };
}
