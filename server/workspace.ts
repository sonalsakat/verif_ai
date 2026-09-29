import { randomUUID } from "node:crypto";
import { query, recordAudit, withTransaction, db } from "./postgres";
import type { AppUser } from "./supabase";
import { getConnectorRegistry } from "./connectors";

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
    query(`select t.id, t.external_id as "externalId", t.external_id like 'DEMO-%' or t.external_id like 'GEM/%' as "isDemo", t.title, t.department, t.description,
      to_char(t.submission_deadline, 'DD Mon YYYY') as closing, t.submission_deadline as "submissionDeadline",
      t.bid_opening_date as "bidOpeningDate", coalesce(t.estimated_value, 0)::text as value, t.status, t.progress,
      (select count(*) from public.bids b where b.tender_id = t.id)::int as bidders,
      (select count(*) from public.compliance_checks cc where cc.tender_id = t.id and cc.result = 'Verified')::int as verified,
      (select count(*) from public.compliance_checks cc where cc.tender_id = t.id and cc.result = 'Needs Review')::int as review,
      t.created_at as "createdAt", t.updated_at as "updatedAt"
      from public.tenders t where t.organization_id = $1 order by t.created_at desc`, [user.organizationId]),
    query(`select b.id, b.name, b.registration_id as registration, b.registration_id like 'DEMO-%' as "isDemo", b.gstin, b.pan, b.status,
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
      cc.requirement, cc.evidence, cc.source, true as "isDemo", cc.result, cc.confidence, cc.detail, cc.rule, cc.checked_at as checked,
      t.title as "tenderTitle", b.name as "bidderName",
      e.document_id as "documentId", coalesce(e.document_name, '—') as document, coalesce(e.page_number, '—') as page,
      coalesce(e.extracted_value, '') as extracted, coalesce(e.relevant_evidence, '') as "relevantEvidence",
      coalesce(e.source_status, cc.source) as "sourceStatus", coalesce(e.confidence, cc.confidence) as "evidenceConfidence"
      from public.compliance_checks cc join public.tenders t on t.id = cc.tender_id join public.bidders b on b.id = cc.bidder_id left join lateral (
        select * from public.evidence e0 where e0.check_id = cc.id order by e0.created_at desc limit 1
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
  const mappedTenders = tenderRows.map((row) => ({ ...row, bidders: int(row.bidders), verified: int(row.verified), review: int(row.review) }));
  const mappedBidders = bidderRows.map((row) => ({ ...row, documents: `${int(row.documentCount)} / ${Math.max(int(row.totalChecks), 1)}`, lastChecked: row.lastChecked ? new Date(String(row.lastChecked)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Active (Sandbox)" }));
  const mappedDocuments = documentRows.map((row) => ({ ...row, date: row.uploaded ? new Date(String(row.uploaded)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—" }));
  const mappedChecks = checkRows.map((row) => ({ ...row, checked: row.checked ? new Date(String(row.checked)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—", claim: row.extracted || "No extracted claim", page: row.page || "1" }));
  const mappedAudit = auditEvents.rows;

  return {
    organization: { id: user.organizationId, name: user.organizationName },
    tenders: mappedTenders,
    bidders: mappedBidders,
    requirements: requirements.rows,
    documents: mappedDocuments,
    checks: mappedChecks,
    evidence: evidence.rows,
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

/** Comprehensive, realistic SIH 2026 Procurement Dataset */
async function ensureDemoWorkspace(user: AppUser) {
  // If embedded store already has tenders, skip
  if (db.tenders.length >= 2) return;

  await withTransaction(async (client) => {
    // 1. Tenders
    const t1 = await client.query<{ id: string }>(`insert into public.tenders
      (organization_id, external_id, title, department, description, submission_deadline, bid_opening_date, estimated_value, status, progress, created_by)
      values ($1, 'GEM/2026/B/894211', 'Supply & Commissioning of High-Resolution Digital Radiography & Ultrasound Systems', 'Directorate of Health Services, Maharashtra',
      'Turnkey procurement of 240 units dual-detector digital radiography and color doppler ultrasonography systems for district civil hospitals across Maharashtra.', current_date + 25, current_date + 30, 148000000, 'Under Verification', 78, $2) returning id`, [user.organizationId, user.id]);

    const t2 = await client.query<{ id: string }>(`insert into public.tenders
      (organization_id, external_id, title, department, description, submission_deadline, bid_opening_date, estimated_value, status, progress, created_by)
      values ($1, 'GEM/2026/B/712093', 'Turnkey Hybrid Solar Power & Battery Energy Storage for District Civil Hospitals', 'Public Works & Renewable Energy Dept, Maharashtra',
      'Design, supply, installation and 5-year comprehensive maintenance of 1.2 MW rooftop solar PV plants with 2.4 MWh lithium iron phosphate (LFP) BESS.', current_date + 40, current_date + 45, 94000000, 'Documents Pending', 42, $2) returning id`, [user.organizationId, user.id]);

    const t3 = await client.query<{ id: string }>(`insert into public.tenders
      (organization_id, external_id, title, department, description, submission_deadline, bid_opening_date, estimated_value, status, progress, created_by)
      values ($1, 'GEM/2026/B/553819', 'Integrated City Surveillance, AI Face-Recognition Cameras & Command Center Hardware', 'Maharashtra Smart City Mission & Directorate of Police Telecommunications',
      'Turnkey deployment of 1,200 4K PTZ IP cameras, ANPR edge cameras, and command control room server racks across municipal junctions.', current_date + 18, current_date + 22, 285000000, 'Under Verification', 65, $2) returning id`, [user.organizationId, user.id]);

    const t4 = await client.query<{ id: string }>(`insert into public.tenders
      (organization_id, external_id, title, department, description, submission_deadline, bid_opening_date, estimated_value, status, progress, created_by)
      values ($1, 'GEM/2026/B/339102', 'High-Density Server Infrastructure & Tier-III Disaster Recovery Cloud Setup', 'State Data Centre (SDC), Directorate of Information Technology',
      'Procurement of hyper-converged compute nodes, SAN storage arrays, and redundant 10Gbps air-gapped backup replication for state citizen portals.', current_date + 12, current_date + 15, 182000000, 'Ready for Decision', 95, $2) returning id`, [user.organizationId, user.id]);

    const tender1Id = t1.rows[0].id;
    const tender2Id = t2.rows[0].id;
    const tender3Id = t3.rows[0].id;
    const tender4Id = t4.rows[0].id;

    // 2. Bidders
    const b1 = await client.query<{ id: string }>(`insert into public.bidders
      (organization_id, name, registration_id, gstin, pan, status, compliance_score, risk, last_checked)
      values ($1, 'Sahyadri Clinical Systems Pvt. Ltd.', 'DEMO-UDYAM-MH-18-0048217', '27AAMCS7421G1Z4', 'AAMCS7421G', 'Verified', 100, 'Low', now()) returning id`, [user.organizationId]);

    const b2 = await client.query<{ id: string }>(`insert into public.bidders
      (organization_id, name, registration_id, gstin, pan, status, compliance_score, risk, last_checked)
      values ($1, 'Aarohan Medical Technologies LLP', 'DEMO-UDYAM-MH-18-0081502', '27AAKFA4102D1Z7', 'AAKFA4102D', 'Needs Review', 60, 'Medium', now()) returning id`, [user.organizationId]);

    const b3 = await client.query<{ id: string }>(`insert into public.bidders
      (organization_id, name, registration_id, gstin, pan, status, compliance_score, risk, last_checked)
      values ($1, 'Zenith Defense & Surveillance Solutions Ltd.', 'DEMO-UDYAM-DL-03-0091823', '07AAACZ1189M1Z8', 'AAACZ1189M', 'Verified', 95, 'Low', now()) returning id`, [user.organizationId]);

    const b4 = await client.query<{ id: string }>(`insert into public.bidders
      (organization_id, name, registration_id, gstin, pan, status, compliance_score, risk, last_checked)
      values ($1, 'Kavach Cybernetix Pvt. Ltd.', 'DEMO-DPIIT-STP-2024-99120', '27AAGCK8412F1Z2', 'AAGCK8412F', 'Verified', 85, 'Low', now()) returning id`, [user.organizationId]);

    const b5 = await client.query<{ id: string }>(`insert into public.bidders
      (organization_id, name, registration_id, gstin, pan, status, compliance_score, risk, last_checked)
      values ($1, 'Nexus Power & Infraworks Corp', 'DEMO-REG-DL-2021-0491', '07AABCN9921B1Z3', 'AABCN9921B', 'Non-Compliant', 15, 'High', now()) returning id`, [user.organizationId]);

    const b6 = await client.query<{ id: string }>(`insert into public.bidders
      (organization_id, name, registration_id, gstin, pan, status, compliance_score, risk, last_checked)
      values ($1, 'Pragati Renewables India Pvt. Ltd.', 'DEMO-UDYAM-MH-27-0027331', '27AAGCP9031H1ZQ', 'AAGCP9031H', 'Verified', 80, 'Low', now()) returning id`, [user.organizationId]);

    const sahyadri = b1.rows[0].id;
    const aarohan = b2.rows[0].id;
    const zenith = b3.rows[0].id;
    const kavach = b4.rows[0].id;
    const nexus = b5.rows[0].id;
    const pragati = b6.rows[0].id;

    // 3. Link Bids
    await client.query(`insert into public.bids (tender_id, bidder_id, status) values
      ($1, $5, 'Under Verification'), ($1, $6, 'Under Verification'),
      ($2, $9, 'Non-Compliant'), ($2, $10, 'Under Verification'),
      ($3, $7, 'Under Verification'), ($3, $8, 'Under Verification'),
      ($4, $7, 'Under Verification')`,
      [tender1Id, tender2Id, tender3Id, tender4Id, sahyadri, aarohan, zenith, kavach, nexus, pragati]
    );

    // 4. Tender Requirements
    const r1 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'Valid GST Registration & Active Return Filing', 'Statutory', 'GST registration certificate matching the bidder legal name with active filing status for past 2 fiscal quarters', 'Standard Procurement Ruleset', 'Active') returning id`, [tender1Id]);
    const r2 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'Medical Device OEM Authorization & ISO 13485', 'Technical', 'Direct Manufacturer Authorization Form (MAF) specifying model numbers and certified quality compliance under ISO 13485:2016', 'Technical Evaluation Committee', 'Active') returning id`, [tender1Id]);
    const r3 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'Minimum 3-Year Audited Average Turnover ≥ ₹10 Cr', 'Financial', 'CA-certified turnover certificate with UDIN and audited balance sheets for FY 2022-25', 'Financial Qualifying Criteria', 'Active') returning id`, [tender1Id]);
    const r4 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'Prior Supply Experience (≥ 100 units)', 'Experience', 'Client sign-off, work orders or completion certificates from government or accredited multi-specialty hospitals', 'Experience Ruleset', 'Active') returning id`, [tender1Id]);
    const r5 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'Make in India Local Content Declaration (≥ 50%)', 'Local content', 'Class-I Local Supplier self-declaration detailing location of local value addition and statutory auditor certification', 'Public Procurement Policy (PMI)', 'Active') returning id`, [tender1Id]);

    // Solar Tender Requirements
    const r6 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'Class-A Electrical Contractor License', 'Statutory', 'Valid electrical contractor license issued by Government of Maharashtra Licensing Board', 'Safety & Statutory Rules', 'Active') returning id`, [tender2Id]);
    const r7 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'Non-Debarment Affidavit & Integrity Pact', 'Eligibility', 'Notarized affidavit affirming no debarment across central/state portals and signed integrity pact under GFR Rule 151', 'Vigilance & Ethics Ruleset', 'Active') returning id`, [tender2Id]);

    // Surveillance Tender Requirements
    const r8 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'CMMI Level 3 or Higher Software Appraisal', 'Technical', 'Active CMMI Maturity Level 3 assessment for system integration published on SEI partner registry', 'Smart City Quality Mandate', 'Active') returning id`, [tender3Id]);
    const r9 = await client.query<{ id: string }>(`insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
      values ($1, 'CERT-In Empanelled Cybersecurity Audit Clearance', 'Statutory', 'Mandatory penetration testing & source code security compliance from CERT-In auditor', 'Cyber Security Division', 'Active') returning id`, [tender3Id]);

    // 5. Pre-seeded Evidence Documents in Vault
    const d1 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/sahyadri-gst.pdf', 'SAMPLE-GST-Registration-Sahyadri.pdf', 'application/pdf', 184200, 'GST Registration Certificate', 'Processed', 'Verified',
      'GOVERNMENT OF INDIA · GOODS AND SERVICES TAX REGISTRATION CERTIFICATE · Registration Number: 27AAMCS7421G1Z4 · Legal Name: Sahyadri Clinical Systems Pvt. Ltd. · Constitution: Private Limited Company · Date of Liability: 01/07/2017 · Status: Active Regular Taxpayer · Principal Place of Business: MIDC Chakan Phase-II, Pune', $4) returning id`,
      [user.organizationId, tender1Id, sahyadri, user.id]
    );

    const d2 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/sahyadri-turnover.pdf', 'SAMPLE-Audited-Balance-Sheet-Sahyadri.pdf', 'application/pdf', 312400, 'Audited Financial Statement', 'Processed', 'Verified',
      'S. K. MEHTA & ASSOCIATES CHARTERED ACCOUNTANTS · UDIN: 25048217AAAA0192 · Independent Statutory Auditor Report · Sahyadri Clinical Systems Pvt. Ltd. · Annual Turnover FY 2024-25: ₹16.42 Cr · FY 2023-24: ₹14.85 Cr · FY 2022-23: ₹12.10 Cr · 3-Year Average: ₹14.45 Cr · Net Worth: Positive ₹9.80 Cr · Zero Tax Arrears', $4) returning id`,
      [user.organizationId, tender1Id, sahyadri, user.id]
    );

    const d3 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/sahyadri-pmi.pdf', 'SAMPLE-Make-In-India-Declaration-Sahyadri.pdf', 'application/pdf', 142000, 'Make in India Declaration', 'Processed', 'Verified',
      'PUBLIC PROCUREMENT (PREFERENCE TO MAKE IN INDIA) ORDER DECLARATION · Bidder: Sahyadri Clinical Systems Pvt. Ltd. · Supplier Class: Class-I Local Supplier · Percentage of Local Content: 58.4% · Facility Location: MIDC Chakan, Phase-II, Pune, Maharashtra · Auditor Certificate: Certified by CA S. K. Mehta', $4) returning id`,
      [user.organizationId, tender1Id, sahyadri, user.id]
    );

    const d4 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/sahyadri-exp.pdf', 'SAMPLE-Hospital-Supply-Work-Order-Sahyadri.pdf', 'application/pdf', 215000, 'Work Order & Completion Certificate', 'Processed', 'Verified',
      'DIRECTORATE OF MEDICAL EDUCATION & RESEARCH · Work Order Ref: MH-HOSP-DEMO-024 · Contractor: Sahyadri Clinical Systems Pvt. Ltd. · Scope: Supply, installation & commissioning of 240 units Digital Radiography Equipment across GMC Nagpur, Pune & Aurangabad · Status: Successfully Completed & Satisfactory Handover Recorded', $4) returning id`,
      [user.organizationId, tender1Id, sahyadri, user.id]
    );

    const d5 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/aarohan-gst.pdf', 'SAMPLE-GST-Certificate-Aarohan.pdf', 'application/pdf', 165000, 'GST Registration Certificate', 'Processed', 'Verified',
      'GSTIN 27AAKFA4102D1Z7 · Aarohan Medical Technologies LLP · Registration Status: Active · Taxpayer Type: Regular · Principal Place: Andheri East, Mumbai', $4) returning id`,
      [user.organizationId, tender1Id, aarohan, user.id]
    );

    const d6 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/zenith-certin.pdf', 'SAMPLE-CERT-In-Audit-Zenith.pdf', 'application/pdf', 278000, 'Cybersecurity Audit Report', 'Processed', 'Verified',
      'CERT-In EMPANELLED CYBER AUDIT CLEARANCE · Auditor: KPMG Cyber Defense Services · Certificate #CERT-IN/2025/AUD/8491 · Entity: Zenith Defense & Surveillance Solutions Ltd. · Result: NO CRITICAL OR HIGH VULNERABILITIES IDENTIFIED · Firmware SHA-256 Validated', $4) returning id`,
      [user.organizationId, tender3Id, zenith, user.id]
    );

    const d7 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/kavach-dpiit.pdf', 'SAMPLE-DPIIT-Startup-Recognition-Kavach.pdf', 'application/pdf', 188000, 'DPIIT Recognition Certificate', 'Processed', 'Verified',
      'MINISTRY OF COMMERCE AND INDUSTRY (DPIIT) · Certificate of Recognition · Number: DIPP120938 · Startup Name: Kavach Cybernetix Pvt. Ltd. · Valid for Public Procurement Turnover & Prior Experience Relaxations under Rule 170(i) GFR 2017', $4) returning id`,
      [user.organizationId, tender3Id, kavach, user.id]
    );

    const d8 = await client.query<{ id: string }>(`insert into public.documents
      (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, uploaded_by)
      values ($1, $2, $3, 'docs/nexus-debarment.pdf', 'SAMPLE-Debarment-Flag-Nexus.pdf', 'application/pdf', 195000, 'Debarment Notice', 'Processed', 'Verified',
      'CENTRAL PUBLIC PROCUREMENT PORTAL · DEBARMENT ORDER REF: CVC/DEB/2024/019 · Entity: Nexus Power & Infraworks Corp · Director: Ashok Mehra · Reason: Wilful Default and Submission of Falsified Bank Guarantee in Solar Tender #PWR-2023-091 · Period of Debarment: 3 Years (Until 13-Jan-2027)', $4) returning id`,
      [user.organizationId, tender2Id, nexus, user.id]
    );

    // 6. Comprehensive "PROVE IT" Verification Checks
    const checkItems = [
      // Sahyadri (100% compliant)
      {
        tender: tender1Id, bidder: sahyadri, req: r1.rows[0].id, title: 'Valid GST Registration & Active Return Filing',
        result: 'Verified', docId: d1.rows[0].id, docName: 'SAMPLE-GST-Registration-Sahyadri.pdf', page: '1',
        value: 'GSTIN 27AAMCS7421G1Z4 · Status: Active Regular · Sahyadri Clinical Systems Pvt. Ltd.',
        excerpt: 'GST registration is verified active with regular return filings (GSTR-1 & 3B up to Jan 2026). Legal entity name matches bidder profile exactly.',
        detail: 'GSTN Gateway verified: Active taxpayer. Match confidence 99.8%. Zero tax defaults.',
        rule: 'GST registration evidence present & validated against GSTN registry',
        sourceStatus: 'GSTN Sandbox Gateway · SHA-256 Validated',
        confidence: 'High'
      },
      {
        tender: tender1Id, bidder: sahyadri, req: r2.rows[0].id, title: 'Medical Device OEM Authorization & ISO 13485',
        result: 'Verified', docId: d4.rows[0].id, docName: 'SAMPLE-Hospital-Supply-Work-Order-Sahyadri.pdf', page: '2',
        value: 'ISO 13485:2016 Certified Manufacturer · License #CM/L-8192837',
        excerpt: 'Certified quality management for medical diagnostic radiography. OEM authorization directly validated by manufacturer.',
        detail: 'BIS / DPIIT gateway cross-checked: Valid through 2027. All lab clearance test reports verified.',
        rule: 'ISO 13485 medical device quality certification present',
        sourceStatus: 'BIS Gateway · Document Verified',
        confidence: 'High'
      },
      {
        tender: tender1Id, bidder: sahyadri, req: r3.rows[0].id, title: 'Minimum 3-Year Audited Average Turnover ≥ ₹10 Cr',
        result: 'Verified', docId: d2.rows[0].id, docName: 'SAMPLE-Audited-Balance-Sheet-Sahyadri.pdf', page: '1',
        value: '3-Year Average Turnover: ₹14.45 Cr (FY 2022-25) · UDIN: 25048217AAAA0192',
        excerpt: 'Statutory auditor report confirms audited turnover exceeding ₹10 Cr threshold. UDIN registered on ICAI portal.',
        detail: 'Income Tax compliance verified: Form 26AS cross-checked against MCA21 filing.',
        rule: 'Audited turnover meets or exceeds tender financial threshold',
        sourceStatus: 'ICAI UDIN & IT Portal Verified',
        confidence: 'High'
      },
      {
        tender: tender1Id, bidder: sahyadri, req: r4.rows[0].id, title: 'Prior Supply Experience (≥ 100 units)',
        result: 'Verified', docId: d4.rows[0].id, docName: 'SAMPLE-Hospital-Supply-Work-Order-Sahyadri.pdf', page: '1',
        value: '240 Units Delivered · Work Order MH-HOSP-DEMO-024',
        excerpt: 'Work order and completion certificate confirm successful delivery and installation of 240 units to Government Medical Colleges.',
        detail: 'State Health Procurement database cross-check: Satisfactory performance recorded.',
        rule: 'Demonstrated past delivery volume meeting tender minimum',
        sourceStatus: 'State Health Directorate Verified',
        confidence: 'High'
      },
      {
        tender: tender1Id, bidder: sahyadri, req: r5.rows[0].id, title: 'Make in India Local Content Declaration (≥ 50%)',
        result: 'Verified', docId: d3.rows[0].id, docName: 'SAMPLE-Make-In-India-Declaration-Sahyadri.pdf', page: '1',
        value: 'Class-I Local Supplier · 58.4% Local Value Addition',
        excerpt: 'Self-declaration backed by statutory auditor certificate confirming 58.4% local value addition at Chakan MIDC facility.',
        detail: 'DPIIT Make in India portal: Class-I purchase preference granted.',
        rule: 'Local content meets Class-I procurement preference threshold',
        sourceStatus: 'Make in India Portal · Auditor Certified',
        confidence: 'High'
      },

      // Aarohan (Needs Review - Missing OEM Authorization)
      {
        tender: tender1Id, bidder: aarohan, req: r1.rows[0].id, title: 'Valid GST Registration & Active Return Filing',
        result: 'Verified', docId: d5.rows[0].id, docName: 'SAMPLE-GST-Certificate-Aarohan.pdf', page: '1',
        value: 'GSTIN 27AAKFA4102D1Z7 · Active · Aarohan Medical Technologies LLP',
        excerpt: 'GST certificate verified active with no tax default notices.',
        detail: 'GSTN Gateway match verified. Identity matches bidder registration.',
        rule: 'GST registration evidence present & validated against GSTN registry',
        sourceStatus: 'GSTN Sandbox Gateway · Validated',
        confidence: 'High'
      },
      {
        tender: tender1Id, bidder: aarohan, req: r2.rows[0].id, title: 'Medical Device OEM Authorization & ISO 13485',
        result: 'Needs Review', docId: null, docName: 'Not submitted', page: '—',
        value: 'Missing direct OEM Manufacturer Authorization Letter',
        excerpt: 'Bidder provided third-party distributor agreement instead of required direct OEM authorization. Model numbers not specified.',
        detail: 'OFFICER ATTENTION REQUIRED: Clause 4.2 requires direct OEM commitment of 5-year warranty.',
        rule: 'OEM direct manufacturer authorization must be present',
        sourceStatus: 'Bidder Submission Incomplete',
        confidence: 'Low'
      },
      {
        tender: tender1Id, bidder: aarohan, req: r3.rows[0].id, title: 'Minimum 3-Year Audited Average Turnover ≥ ₹10 Cr',
        result: 'Verified', docId: d5.rows[0].id, docName: 'SAMPLE-GST-Certificate-Aarohan.pdf', page: '1',
        value: 'Average Turnover: ₹11.20 Cr',
        excerpt: 'Audited financial statements show ₹11.20 Cr average turnover across preceding three fiscal years.',
        detail: 'Exceeds ₹10 Cr requirement by 12%. UDIN verified.',
        rule: 'Audited turnover meets or exceeds tender financial threshold',
        sourceStatus: 'Audited Statement Verified',
        confidence: 'High'
      },

      // Zenith (Verified - Surveillance)
      {
        tender: tender3Id, bidder: zenith, req: r8.rows[0].id, title: 'CMMI Level 3 or Higher Software Appraisal',
        result: 'Verified', docId: d6.rows[0].id, docName: 'SAMPLE-CERT-In-Audit-Zenith.pdf', page: '1',
        value: 'CMMI-DEV Maturity Level 3 · Appraisal #58201',
        excerpt: 'Active appraisal published on CMMI Institute Partner Registry covering software system integration.',
        detail: 'CMMI Appraisal ID #58201 verified through 2027.',
        rule: 'CMMI Level 3 quality appraisal active',
        sourceStatus: 'CMMI Global Registry Verified',
        confidence: 'High'
      },
      {
        tender: tender3Id, bidder: zenith, req: r9.rows[0].id, title: 'CERT-In Empanelled Cybersecurity Audit Clearance',
        result: 'Verified', docId: d6.rows[0].id, docName: 'SAMPLE-CERT-In-Audit-Zenith.pdf', page: '1',
        value: 'CERT-In Clearance #CERT-IN/2025/AUD/8491 · Zero Critical Vulnerabilities',
        excerpt: 'Security audit conducted by CERT-In empanelled auditor KPMG confirms no undocumented backdoors or spyware in camera firmware.',
        detail: 'MeitY National Cyber Security Coordinator compliance verified.',
        rule: 'CERT-In audit certificate present with clean security clearance',
        sourceStatus: 'CERT-In Empanelled Gateway · Validated',
        confidence: 'High'
      },

      // Kavach (Startup Exemption)
      {
        tender: tender3Id, bidder: kavach, req: r8.rows[0].id, title: 'CMMI Level 3 or Higher Software Appraisal',
        result: 'Verified', docId: d7.rows[0].id, docName: 'SAMPLE-DPIIT-Startup-Recognition-Kavach.pdf', page: '1',
        value: 'DPIIT Recognition #DIPP120938 · Exemption under Rule 170(i) GFR 2017',
        excerpt: 'DPIIT recognized entity in AI surveillance qualifying for procurement exemptions under Central Public Procurement Policy.',
        detail: 'Procurement policy allows technical relaxation for recognized innovations.',
        rule: 'DPIIT startup recognition certificate verified for policy exemption',
        sourceStatus: 'Startup India Gateway · Verified',
        confidence: 'High'
      },

      // Nexus Power (Flagged High-Risk Debarred Bidder!)
      {
        tender: tender2Id, bidder: nexus, req: r6.rows[0].id, title: 'Class-A Electrical Contractor License',
        result: 'Needs Review', docId: d8.rows[0].id, docName: 'SAMPLE-Debarment-Flag-Nexus.pdf', page: '1',
        value: 'License Expired on 31-March-2024 · Renewal Not Evident',
        excerpt: 'Submitted electrical contractor license expired prior to tender publication date. Renewal application pending.',
        detail: 'State Licensing Board registry check: License status marked as LAPSED.',
        rule: 'Active Class-A Electrical Contractor License mandatory',
        sourceStatus: 'State Electrical Licensing Board · Lapsed',
        confidence: 'Low'
      },
      {
        tender: tender2Id, bidder: nexus, req: r7.rows[0].id, title: 'Non-Debarment Affidavit & Integrity Pact',
        result: 'Non-Compliant', docId: d8.rows[0].id, docName: 'SAMPLE-Debarment-Flag-Nexus.pdf', page: '1',
        value: 'CRITICAL ALERT: Listed on Central Debarment Repository (Order #CVC/DEB/2024/019)',
        excerpt: 'Bidder filed false non-debarment affidavit. Cross-verification against National Debarment Gateway revealed active 3-year debarment until 2027.',
        detail: 'STRICT DISQUALIFICATION: Active debarment by Ministry of Power for submitting forged bank guarantees.',
        rule: 'Bidder must not be debarred by any Central or State Ministry under Rule 151 GFR',
        sourceStatus: 'Central Vigilance & CPPP Debarment Registry · FLAGGED',
        confidence: 'High'
      },

      // Pragati (Solar EPC)
      {
        tender: tender2Id, bidder: pragati, req: r6.rows[0].id, title: 'Class-A Electrical Contractor License',
        result: 'Verified', docId: null, docName: 'SAMPLE-Contractor-License-Pragati.pdf', page: '1',
        value: 'Maharashtra Class-A License #MH/EL/2021/8401 · Valid to 2028',
        excerpt: 'Valid Class-A electrical license approved for HT/EHT substation and solar installations up to 33 kV.',
        detail: 'State Licensing Board: Good standing, zero safety violations.',
        rule: 'Active Class-A Electrical Contractor License mandatory',
        sourceStatus: 'State Electrical Licensing Board · Validated',
        confidence: 'High'
      },
    ];

    for (const item of checkItems) {
      const checkRes = await client.query<{ id: string }>(`insert into public.compliance_checks
        (organization_id, tender_id, bidder_id, requirement_id, requirement, evidence, source, result, confidence, detail, rule)
        values ($1, $2, $3, $4, $5, $6, 'Deterministic compliance engine', $7, $8, $9, $10) returning id`,
        [user.organizationId, item.tender, item.bidder, item.req, item.title, item.docName, item.result, item.confidence, item.detail, item.rule]
      );
      const checkId = checkRes.rows[0].id;

      await client.query(`insert into public.evidence
        (check_id, document_id, source, document_name, page_number, extracted_value, relevant_evidence, source_status, confidence)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [checkId, item.docId, item.sourceStatus, item.docName, item.page, item.value, item.excerpt, item.sourceStatus, item.confidence]
      );
    }

    // 7. Initial Audit Events
    await client.query(`insert into public.audit_events (organization_id, user_id, action, entity, status, metadata)
      values
      ($1, $2, 'Initialized SIH 2026 Procurement Workspace', 'Directorate of Health Services', 'Completed', '{"tenders":4,"bidders":6,"rules":8}'::jsonb),
      ($1, $2, 'Compliance Rules Engine executed verification batch', 'Tender GEM/2026/B/894211', 'Completed', '{"checksExecuted":5,"verified":5}'::jsonb),
      ($1, $2, 'Debarment Registry flagged suspicious bidder', 'Nexus Power & Infraworks Corp', 'Non-Compliant', '{"debarmentOrder":"CVC/DEB/2024/019","action":"Disqualification Recommended"}'::jsonb),
      ($1, $2, 'Officer opened evidence audit trace (PROVE IT)', 'Sahyadri Clinical Systems Pvt. Ltd.', 'Verified', '{"requirement":"Make in India (≥ 50%)","traceId":"PROVE-IT-9182"}'::jsonb)`,
      [user.organizationId, user.id]
    );

    // 8. Officer Decision for Sahyadri
    await client.query(`insert into public.officer_decisions (organization_id, tender_id, bidder_id, decision, comment, officer_id)
      values ($1, $2, $3, 'Qualified', 'All 5 compliance requirements fully verified against submitted evidence and government registry gateways. Genuine MSME with 58.4% local content.', $4)`,
      [user.organizationId, tender1Id, sahyadri, user.id]
    );
  });
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
  const requirements = await query<{ id: string; title: string; category: string; evidence_required: string }>(`select r.id, r.title, r.category, r.evidence_required from public.tender_requirements r join public.tenders t on t.id = r.tender_id where r.tender_id = $1 and t.organization_id = $2 order by r.created_at`, [input.tenderId, user.organizationId]);
  const documents = await query<{ id: string; file_name: string; document_type: string; extraction: Record<string, unknown> | null; extracted_text: string | null }>(`select id, file_name, document_type, extraction, extracted_text from public.documents where bidder_id = $1 and organization_id = $2`, [input.bidderId, user.organizationId]);
  if (requirements.rows.length === 0) return { checks: [], message: "No requirements are active for this tender yet." };

  const inserted: Array<Record<string, unknown>> = [];
  for (const requirement of requirements.rows) {
    const match = documents.rows.find((document) => `${document.document_type} ${document.file_name}`.toLowerCase().includes(requirement.title.toLowerCase().split(" ")[0]));
    const result = match ? "Verified" : "Pending";
    const confidence = match ? "High" : "Low";
    const detail = match ? `Evidence matched in ${match.file_name}. Deterministic document-to-requirement match verified.` : `No supporting document found for ${requirement.title}. Officer follow-up required.`;
    const check = await query(`insert into public.compliance_checks (organization_id, tender_id, bidder_id, requirement_id, requirement, evidence, source, result, confidence, detail, rule)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning id, requirement, evidence, source, result, confidence, detail, rule, checked_at as checked`, [user.organizationId, input.tenderId, input.bidderId, requirement.id, requirement.title, match?.file_name ?? "Not submitted", match ? "Submitted document" : "Bidder submissions", result, confidence, detail, `${requirement.title} evidence present`]);
    const row = check.rows[0];
    if (match) {
      await query(`insert into public.evidence (check_id, document_id, source, document_name, page_number, extracted_value, relevant_evidence, source_status, confidence) values ($1, $2, 'Submitted document', $3, '1', $4, $5, 'Document evidence · matched', $6)`, [row.id, match.id, match.file_name, match.extracted_text?.slice(0, 240) || "Document uploaded and classified", detail, confidence]);
    }
    inserted.push(row);
  }

  await query(`update public.bidders set last_checked = now(), compliance_score = (select coalesce(round(avg(case when result = 'Verified' then 100 when result = 'Needs Review' then 60 else 0 end)), 0)::int from public.compliance_checks where bidder_id = $1), status = case when exists (select 1 from public.compliance_checks where bidder_id = $1 and result = 'Pending') then 'Needs Review' else 'Verified' end, updated_at = now() where id = $1 and organization_id = $2`, [input.bidderId, user.organizationId]);
  await recordAudit(user, "Rules engine completed automated verification batch", input.bidderId, "Completed", { tenderId: input.tenderId, checkCount: inserted.length });
  return { checks: inserted, message: `${inserted.length} deterministic compliance checks completed successfully.` };
}
