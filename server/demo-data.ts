import { Buffer } from "node:buffer";
import { query, withTransaction } from "./postgres";
import type { AppUser } from "./supabase";

type VerificationResult = "Verified" | "Needs Review" | "Pending Verification";
type Confidence = "High" | "Medium" | "Low";

type EvidenceFixture = {
  source: string;
  documentName: string;
  page: string;
  extractedValue: string;
  relevantEvidence: string;
  sourceStatus: string;
  confidence: Confidence;
  fileKey?: string;
  documentType?: string;
  documentText?: string;
  extraction?: Record<string, unknown>;
};

type RequirementFixture = {
  key: string;
  title: string;
  category: string;
  evidenceRequired: string;
  source: string;
  rule: string;
  documentType: string;
};

type CheckOverride = {
  result: VerificationResult;
  detail: string;
  confidence: Confidence;
  evidence: EvidenceFixture[];
};

type BidderFixture = {
  key: string;
  name: string;
  registrationId: string;
  gstin: string;
  pan: string;
  status: VerificationResult;
  complianceScore: number;
  risk: "Low" | "Medium";
  claims: Record<string, string>;
  exception?: { requirementKey: string; check: CheckOverride };
};

type TenderFixture = {
  externalId: string;
  title: string;
  department: string;
  description: string;
  deadlineDays: number;
  openingDays: number;
  estimatedValue: string;
  progress: number;
  requirements: RequirementFixture[];
  bidders: BidderFixture[];
};

const sampleDocument = (
  bidder: BidderFixture,
  requirement: RequirementFixture,
  claim: string,
  options: { suffix?: string; page?: string; field?: string; value?: string } = {},
): EvidenceFixture => {
  const suffix = options.suffix ?? requirement.key;
  const fileKey = `sih26-demo/${bidder.key}/${suffix}.pdf`;
  const documentName = `SAMPLE-${bidder.key.toUpperCase()}-${suffix.toUpperCase()}.pdf`;
  const documentText = [
    "VERIFAI · DEMO / SAMPLE DATA — NOT AN OFFICIAL DOCUMENT",
    `Bidder: ${bidder.name}`,
    `Requirement: ${requirement.title}`,
    `Page ${options.page ?? "1"}: ${options.value ?? claim}`,
    "This readable text fixture illustrates extraction and traceability only; no legal or government record is represented.",
  ].join("\n");
  return {
    source: "Bidder submission · sample document",
    documentName,
    page: options.page ?? "1",
    extractedValue: options.value ?? claim,
    relevantEvidence: `Extracted from ${documentName}, page ${options.page ?? "1"}: ${options.value ?? claim}`,
    sourceStatus: "SAMPLE DOCUMENT · fictional fixture; no live source call",
    confidence: "High",
    fileKey,
    documentType: requirement.documentType,
    documentText,
    extraction: {
      demo: true,
      requirementKey: requirement.key,
      bidderKey: bidder.key,
      claim,
      ...(options.field ? { comparedField: options.field, comparedValue: options.value ?? claim } : {}),
    },
  };
};

const sandboxResponse = (
  source: string,
  value: string,
  page = "Sandbox response",
): EvidenceFixture => ({
  source,
  documentName: `${source} · SAMPLE SANDBOX RESPONSE`,
  page,
  extractedValue: value,
  relevantEvidence: `Fictional sandbox response supplied for the SIH walkthrough. This is not a live government lookup or an official record.`,
  sourceStatus: "SANDBOX FIXTURE · illustrative only; not a live government response",
  confidence: "High",
});

const unavailableResponse = (source: string): EvidenceFixture => ({
  source,
  documentName: `${source} · no response fixture`,
  page: "API response",
  extractedValue: "No authoritative status returned",
  relevantEvidence: "The sandbox source is unavailable in this sample scenario. No adverse conclusion is inferred; officer review or retry is required.",
  sourceStatus: "SANDBOX UNAVAILABLE · no response; not a negative match",
  confidence: "Low",
});

const tenders: TenderFixture[] = [
  {
    externalId: "DEMO-SIH26-HEALTH-001",
    title: "Supply & Commissioning of Digital Radiography Systems",
    department: "Directorate of Health Services, Maharashtra",
    description: "Fictional SIH sample tender for digital radiography and ultrasound systems for district civil hospitals. All amounts, organizations, dates, claims, documents, and source responses shown are demo fixtures.",
    deadlineDays: 32,
    openingDays: 35,
    estimatedValue: "148000000",
    progress: 68,
    requirements: [
      { key: "gst", title: "Active GST registration and legal-name match", category: "Statutory", evidenceRequired: "GST certificate and an active registration-status response matching the bidder's legal name", source: "GSTN sandbox", rule: "The GSTIN must be active and the registered legal name must match the bidder profile.", documentType: "GST Registration Certificate" },
      { key: "turnover", title: "Audited average annual turnover ≥ ₹10 Cr", category: "Financial", evidenceRequired: "Audited financial statements and CA turnover certificate for FY 2022–23 through FY 2024–25", source: "Bidder audited statements · sample evidence", rule: "The three-year audited average annual turnover must be at least ₹10.00 Cr. Conflicting figures must remain Needs Review.", documentType: "Audited Financial Statement" },
      { key: "experience", title: "Prior medical-equipment supply experience ≥ 100 units", category: "Experience", evidenceRequired: "Government work order and completion evidence for at least 100 comparable units", source: "State health procurement sandbox", rule: "Completed comparable government supply must document delivery of at least 100 units.", documentType: "Government Work Order" },
    ],
    bidders: [
      {
        key: "sahyadri", name: "Sahyadri Clinical Systems Pvt. Ltd.", registrationId: "DEMO-SIH26-UDYAM-MH-001", gstin: "27AAMCS7421G1Z4", pan: "AAMCS7421G", status: "Verified", complianceScore: 100, risk: "Low",
        claims: { gst: "GSTIN 27AAMCS7421G1Z4 · Active Regular Taxpayer", turnover: "Audited three-year average turnover: ₹14.45 Cr", experience: "240 digital imaging units delivered to government medical colleges" },
      },
      {
        key: "aarohan", name: "Aarohan Medical Technologies LLP", registrationId: "DEMO-SIH26-UDYAM-MH-002", gstin: "27AAKFA4102D1Z7", pan: "AAKFA4102D", status: "Needs Review", complianceScore: 67, risk: "Medium",
        claims: { gst: "GSTIN 27AAKFA4102D1Z7 · Active Regular Taxpayer", turnover: "Bidder-declared audited average turnover: ₹11.20 Cr", experience: "145 comparable medical-equipment units completed" },
        exception: { requirementKey: "turnover", check: {
          result: "Needs Review", confidence: "High",
          detail: "Two submitted financial records conflict: the CA turnover certificate states ₹11.20 Cr while the audited statements calculate ₹8.70 Cr. Both values are shown; VerifAI does not choose one automatically.",
          evidence: [
            sampleDocument({ key: "aarohan", name: "Aarohan Medical Technologies LLP" } as BidderFixture, { key: "turnover", title: "Audited average annual turnover", category: "Financial", evidenceRequired: "CA turnover certificate", source: "Bidder submission", rule: "Three-year average ≥ ₹10 Cr", documentType: "CA Turnover Certificate" }, "Bidder-declared average audited turnover: ₹11.20 Cr", { suffix: "ca-turnover-certificate", page: "2", field: "averageTurnoverCr", value: "₹11.20 Cr" }),
            sampleDocument({ key: "aarohan", name: "Aarohan Medical Technologies LLP" } as BidderFixture, { key: "turnover", title: "Audited average annual turnover", category: "Financial", evidenceRequired: "Audited statements", source: "Bidder submission", rule: "Three-year average ≥ ₹10 Cr", documentType: "Audited Financial Statement" }, "Bidder-declared average audited turnover: ₹11.20 Cr", { suffix: "audited-statements", page: "6", field: "averageTurnoverCr", value: "₹8.70 Cr" }),
          ],
        } },
      },
      {
        key: "meridian", name: "Meridian Diagnostic Devices Pvt. Ltd.", registrationId: "DEMO-SIH26-UDYAM-MH-003", gstin: "27AABCM5824Q1Z9", pan: "AABCM5824Q", status: "Pending Verification", complianceScore: 82, risk: "Low",
        claims: { gst: "GSTIN 27AABCM5824Q1Z9 · certificate states Active", turnover: "Audited three-year average turnover: ₹12.35 Cr", experience: "132 comparable medical-equipment units completed" },
        exception: { requirementKey: "gst", check: {
          result: "Pending Verification", confidence: "Low",
          detail: "The GST certificate is present, but the GSTN sandbox did not return a status response. The bidder remains Pending Verification; source unavailability is not treated as non-compliance.",
          evidence: [
            sampleDocument({ key: "meridian", name: "Meridian Diagnostic Devices Pvt. Ltd." } as BidderFixture, { key: "gst", title: "Active GST registration", category: "Statutory", evidenceRequired: "GST certificate", source: "GSTN sandbox", rule: "Registration must be active.", documentType: "GST Registration Certificate" }, "GSTIN 27AABCM5824Q1Z9 · certificate states Active"),
            unavailableResponse("GSTN sandbox"),
          ],
        } },
      },
    ],
  },
  {
    externalId: "DEMO-SIH26-ENERGY-002",
    title: "District Hospital Rooftop Solar & Battery Storage",
    department: "Public Works & Renewable Energy Department, Maharashtra",
    description: "Fictional SIH sample tender for 1.2 MW rooftop solar PV installations and battery storage across district hospitals. All bids and authority responses are demo fixtures.",
    deadlineDays: 40,
    openingDays: 44,
    estimatedValue: "94000000",
    progress: 53,
    requirements: [
      { key: "license", title: "Valid Class-A electrical contractor licence", category: "Statutory", evidenceRequired: "Class-A electrical contractor licence valid through the tender submission deadline", source: "Maharashtra Electrical Licensing Board sandbox", rule: "The Class-A licence must be current on the tender deadline; contradictory authority and bidder records require officer review.", documentType: "Electrical Contractor Licence" },
      { key: "project", title: "Comparable solar EPC experience ≥ 5 MW", category: "Experience", evidenceRequired: "Government completion certificate showing at least 5 MW of commissioned solar EPC capacity", source: "PWD project-record sandbox", rule: "Completed comparable solar EPC projects must evidence at least 5 MW commissioned capacity.", documentType: "Solar EPC Completion Certificate" },
      { key: "debarment", title: "Non-debarment affidavit and integrity declaration", category: "Eligibility", evidenceRequired: "Signed non-debarment affidavit and a clear sample debarment-registry response", source: "CPPP debarment sandbox", rule: "The bidder must submit a non-debarment declaration and have no active debarment in the checked sample record.", documentType: "Non-Debarment Affidavit" },
    ],
    bidders: [
      {
        key: "pragati", name: "Pragati Renewables India Pvt. Ltd.", registrationId: "DEMO-SIH26-UDYAM-MH-004", gstin: "27AAGCP9031H1ZQ", pan: "AAGCP9031H", status: "Verified", complianceScore: 100, risk: "Low",
        claims: { license: "Maharashtra Class-A licence MH/EL/2021/8401 · valid to 2028", project: "7.8 MW of comparable government solar EPC commissioned", debarment: "Signed non-debarment affidavit; no active listing claimed" },
      },
      {
        key: "suryodaya", name: "Suryodaya Integrated Energy LLP", registrationId: "DEMO-SIH26-UDYAM-MH-005", gstin: "27AANFS3918P1Z5", pan: "AANFS3918P", status: "Needs Review", complianceScore: 67, risk: "Medium",
        claims: { license: "Class-A licence MH/EL/2023/1182 · valid through 31 Dec 2027", project: "6.2 MW of comparable government solar EPC commissioned", debarment: "Signed non-debarment affidavit; no active listing claimed" },
        exception: { requirementKey: "license", check: {
          result: "Needs Review", confidence: "High",
          detail: "The submitted licence shows validity through 31 Dec 2027, but the sample licensing-board response says it expired on 31 Mar 2024. These records conflict and require officer review.",
          evidence: [
            sampleDocument({ key: "suryodaya", name: "Suryodaya Integrated Energy LLP" } as BidderFixture, { key: "license", title: "Class-A electrical contractor licence", category: "Statutory", evidenceRequired: "Current licence", source: "Bidder submission", rule: "Licence must be current at deadline.", documentType: "Electrical Contractor Licence" }, "Class-A licence MH/EL/2023/1182 · valid through 31 Dec 2027", { suffix: "class-a-licence", page: "1", field: "licenceStatus", value: "Valid to 31 Dec 2027" }),
            sandboxResponse("Maharashtra Electrical Licensing Board sandbox", "Licence MH/EL/2023/1182 · status EXPIRED · expiry 31 Mar 2024", "Licence record"),
          ],
        } },
      },
      {
        key: "vidyut", name: "Vidyut Infra Services Pvt. Ltd.", registrationId: "DEMO-SIH26-UDYAM-MH-006", gstin: "27AABCV8145R1Z3", pan: "AABCV8145R", status: "Pending Verification", complianceScore: 82, risk: "Low",
        claims: { license: "Class-A licence MH/EL/2022/5510 · certificate states valid to 2027", project: "5.6 MW of comparable government solar EPC commissioned", debarment: "Signed non-debarment affidavit; no active listing claimed" },
        exception: { requirementKey: "license", check: {
          result: "Pending Verification", confidence: "Low",
          detail: "A sample licence document is available, but the licensing-board sandbox did not return a record. VerifAI keeps this Pending Verification and makes no adverse inference.",
          evidence: [
            sampleDocument({ key: "vidyut", name: "Vidyut Infra Services Pvt. Ltd." } as BidderFixture, { key: "license", title: "Class-A electrical contractor licence", category: "Statutory", evidenceRequired: "Current licence", source: "Maharashtra Electrical Licensing Board sandbox", rule: "Licence must be current at deadline.", documentType: "Electrical Contractor Licence" }, "Class-A licence MH/EL/2022/5510 · certificate states valid to 2027"),
            unavailableResponse("Maharashtra Electrical Licensing Board sandbox"),
          ],
        } },
      },
    ],
  },
  {
    externalId: "DEMO-SIH26-SURVEILLANCE-003",
    title: "Integrated City Surveillance & Command-Centre Equipment",
    department: "Maharashtra Smart City Mission & Directorate of Police Telecommunications",
    description: "Fictional SIH sample tender for city cameras, edge analytics equipment, and command-centre infrastructure. The sample source responses and supplier records are not official.",
    deadlineDays: 26,
    openingDays: 30,
    estimatedValue: "285000000",
    progress: 61,
    requirements: [
      { key: "security", title: "Current CERT-In empanelled security audit clearance", category: "Technical", evidenceRequired: "Current cybersecurity audit from a CERT-In empanelled auditor with no unresolved critical findings", source: "CERT-In sandbox", rule: "A current audit must show no unresolved critical or high-severity security findings.", documentType: "Cybersecurity Audit Report" },
      { key: "identity", title: "Company registration identity consistent across records", category: "Statutory", evidenceRequired: "Certificate of incorporation, GST registration, and matching company master data", source: "MCA21 sandbox", rule: "The company identification number (CIN) must match across submitted documents and the sandbox company master.", documentType: "Company Registration Record" },
      { key: "local", title: "Make in India local content declaration ≥ 50%", category: "Local content", evidenceRequired: "Signed local-content declaration with supporting cost and location evidence", source: "Make in India sandbox", rule: "The declaration must evidence at least 50% local content for this sample preference.", documentType: "Local Content Declaration" },
    ],
    bidders: [
      {
        key: "zenith", name: "Zenith Defense & Surveillance Solutions Ltd.", registrationId: "DEMO-SIH26-MCA-DL-007", gstin: "07AAACZ1189M1Z8", pan: "AAACZ1189M", status: "Verified", complianceScore: 100, risk: "Low",
        claims: { security: "CERT-In audit CERT-IN/2025/AUD/8491 · no critical findings", identity: "CIN U72900DL2018PLC319001 · legal name consistent", local: "Class-I local supplier · 58.4% declared local content" },
      },
      {
        key: "kavach", name: "Kavach Cybernetix Pvt. Ltd.", registrationId: "DEMO-SIH26-DPIIT-MH-008", gstin: "27AAGCK8412F1Z2", pan: "AAGCK8412F", status: "Needs Review", complianceScore: 67, risk: "Medium",
        claims: { security: "Current CERT-In empanelled audit · no critical findings", identity: "CIN U72900MH2021PTC123456 · company records match", local: "Class-I local supplier · 61.0% declared local content" },
        exception: { requirementKey: "identity", check: {
          result: "Needs Review", confidence: "High",
          detail: "The submitted company certificate states CIN U72900MH2021PTC123456, while the MCA21 sandbox response states U72900MH2020PTC123456. The incorporation-year portion differs; both values remain visible for officer review.",
          evidence: [
            sampleDocument({ key: "kavach", name: "Kavach Cybernetix Pvt. Ltd." } as BidderFixture, { key: "identity", title: "Company registration identity", category: "Statutory", evidenceRequired: "Incorporation certificate", source: "Bidder submission", rule: "CIN must match across records.", documentType: "Certificate of Incorporation" }, "CIN U72900MH2021PTC123456 · company records match", { suffix: "certificate-of-incorporation", page: "1", field: "cin", value: "U72900MH2021PTC123456" }),
            sandboxResponse("MCA21 sandbox", "CIN U72900MH2020PTC123456 · SAMPLE COMPANY MASTER RECORD", "Company master record"),
          ],
        } },
      },
      {
        key: "aster", name: "Aster Secure Networks Pvt. Ltd.", registrationId: "DEMO-SIH26-MCA-MH-009", gstin: "27AABCA7721N1Z6", pan: "AABCA7721N", status: "Pending Verification", complianceScore: 82, risk: "Low",
        claims: { security: "Audit certificate CERT-IN/2025/AUD/9214 · no critical findings claimed", identity: "CIN U72900MH2019PTC090112 · registration details consistent", local: "52.5% local content declared" },
        exception: { requirementKey: "security", check: {
          result: "Pending Verification", confidence: "Low",
          detail: "The audit report is present, but the CERT-In sandbox did not return a validation response. The bidder remains Pending Verification; source unavailability is not a non-compliant finding.",
          evidence: [
            sampleDocument({ key: "aster", name: "Aster Secure Networks Pvt. Ltd." } as BidderFixture, { key: "security", title: "CERT-In security audit clearance", category: "Technical", evidenceRequired: "Current audit report", source: "CERT-In sandbox", rule: "Current clean clearance required.", documentType: "Cybersecurity Audit Report" }, "Audit certificate CERT-IN/2025/AUD/9214 · no critical findings claimed"),
            unavailableResponse("CERT-In sandbox"),
          ],
        } },
      },
    ],
  },
];

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeDemoKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function defaultEvidence(
  bidder: BidderFixture,
  requirement: RequirementFixture,
  claim: string,
): EvidenceFixture[] {
  const document = sampleDocument(bidder, requirement, claim);
  return [
    document,
    sandboxResponse(requirement.source, claim),
  ];
}

/**
 * Seeds a self-contained fictional SIH showcase into an otherwise empty workspace.
 * It is safe to call on every snapshot: existing procurement data is preserved and the stable tender-ID prefix prevents duplicate batches.
 */
export async function ensureDemoWorkspace(user: AppUser): Promise<void> {
  const existing = await query<{ externalId?: string }>(
    `select external_id as "externalId" from public.tenders where organization_id = $1`,
    [user.organizationId],
  );
  if (existing.rows.some((row) => String(row.externalId ?? "").startsWith("DEMO-SIH26-"))) return;
  if (existing.rows.length > 0) return;

  let sampleQualifiedTenderId = "";
  let sampleQualifiedBidderId = "";
  await withTransaction(async (client) => {
    for (const tender of tenders) {
      const insertedTender = await client.query<{ id: string }>(
        `insert into public.tenders
          (organization_id, external_id, title, department, description, submission_deadline, bid_opening_date, estimated_value, status, progress, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'Under Verification', $9, $10)
         returning id`,
        [user.organizationId, tender.externalId, tender.title, tender.department, tender.description, dateOffset(tender.deadlineDays), dateOffset(tender.openingDays), tender.estimatedValue, tender.progress, user.id],
      );
      const tenderId = String(insertedTender.rows[0]?.id ?? "");
      if (!tenderId) throw new Error(`Could not seed demo tender ${tender.externalId}`);
      if (tender.externalId === tenders[0].externalId) sampleQualifiedTenderId = tenderId;

      const requirementIds = new Map<string, string>();
      for (const requirement of tender.requirements) {
        const insertedRequirement = await client.query<{ id: string }>(
          `insert into public.tender_requirements (tender_id, title, category, evidence_required, source, status)
           values ($1, $2, $3, $4, $5, 'Active') returning id`,
          [tenderId, requirement.title, requirement.category, requirement.evidenceRequired, requirement.source],
        );
        requirementIds.set(requirement.key, String(insertedRequirement.rows[0]?.id ?? ""));
      }

      for (const bidder of tender.bidders) {
        const insertedBidder = await client.query<{ id: string }>(
          `insert into public.bidders
            (organization_id, name, registration_id, gstin, pan, status, compliance_score, risk, last_checked)
           values ($1, $2, $3, $4, $5, $6, $7, $8, now()) returning id`,
          [user.organizationId, bidder.name, bidder.registrationId, bidder.gstin, bidder.pan, bidder.status, bidder.complianceScore, bidder.risk],
        );
        const bidderId = String(insertedBidder.rows[0]?.id ?? "");
        if (!bidderId) throw new Error(`Could not seed demo bidder ${bidder.name}`);
        if (tender.externalId === tenders[0].externalId && bidder.key === "sahyadri") sampleQualifiedBidderId = bidderId;
        await client.query(
          `insert into public.bids (tender_id, bidder_id, status) values ($1, $2, $3)`,
          [tenderId, bidderId, bidder.status],
        );

        for (const requirement of tender.requirements) {
          const requirementId = requirementIds.get(requirement.key);
          if (!requirementId) throw new Error(`Missing demo requirement ID for ${requirement.key}`);
          const claim = bidder.claims[requirement.key] ?? "No sample claim supplied";
          const exception = bidder.exception?.requirementKey === requirement.key ? bidder.exception.check : undefined;
          const result: VerificationResult = exception?.result ?? "Verified";
          const confidence: Confidence = exception?.confidence ?? "High";
          const records = exception?.evidence ?? defaultEvidence(bidder, requirement, claim);
          const source = records.map((record) => record.source).join(" ↔ ");
          const detail = exception?.detail ?? `The submitted sample document and fictional ${requirement.source} sandbox fixture agree with the rule. Demo evidence only; the connector was not queried live.`;
          const insertedCheck = await client.query<{ id: string }>(
            `insert into public.compliance_checks
              (organization_id, tender_id, bidder_id, requirement_id, requirement, evidence, source, result, confidence, detail, rule)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
            [user.organizationId, tenderId, bidderId, requirementId, requirement.title, claim, source, result, confidence, detail, requirement.rule],
          );
          const checkId = String(insertedCheck.rows[0]?.id ?? "");
          if (!checkId) throw new Error(`Could not seed demo check for ${bidder.name} · ${requirement.title}`);

          const insertedDocuments = new Map<string, string>();
          for (const evidence of records) {
            let documentId: string | null = null;
            if (evidence.fileKey) {
              const cachedId = insertedDocuments.get(evidence.fileKey);
              if (cachedId) {
                documentId = cachedId;
              } else {
                const documentText = evidence.documentText ?? `VERIFAI · DEMO / SAMPLE DATA\n${evidence.extractedValue}`;
                const extraction = {
                  demo: true,
                  requirementId,
                  requirementKey: requirement.key,
                  bidderId,
                  sourceState: result === "Pending Verification" ? "unavailable" : "sandbox-fixture",
                  ...(evidence.extraction ?? {}),
                };
                const insertedDocument = await client.query<{ id: string }>(
                  `insert into public.documents
                    (organization_id, tender_id, bidder_id, file_key, file_name, mime_type, size_bytes, document_type, processing_status, verification_status, extracted_text, extraction, uploaded_by)
                   values ($1, $2, $3, $4, $5, 'application/pdf', $6, $7, 'Processed', 'Verified', $8, $9::jsonb, $10)
                   returning id`,
                  [user.organizationId, tenderId, bidderId, evidence.fileKey, evidence.documentName, Buffer.byteLength(documentText), evidence.documentType ?? requirement.documentType, documentText, JSON.stringify(extraction), user.id],
                );
                documentId = String(insertedDocument.rows[0]?.id ?? "") || null;
                if (documentId) insertedDocuments.set(evidence.fileKey, documentId);
              }
            }

            await client.query(
              `insert into public.evidence
                (check_id, document_id, source, document_name, page_number, extracted_value, relevant_evidence, source_status, confidence)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [checkId, documentId, evidence.source, evidence.documentName, evidence.page, evidence.extractedValue, evidence.relevantEvidence, evidence.sourceStatus, evidence.confidence],
            );
          }

        }
      }
    }

    await client.query(
      `insert into public.audit_events (organization_id, user_id, action, entity, status, metadata)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [user.organizationId, user.id, "Initialized SIH 2026 sample procurement workspace", "DEMO-SIH26 · 3 tenders / 9 bidders", "Completed", JSON.stringify({ demo: true, tenders: 3, bidders: 9, requirements: 9, checks: 27, sourceMode: "sandbox fixtures" })],
    );

    if (sampleQualifiedTenderId && sampleQualifiedBidderId) {
      await client.query(
        `insert into public.officer_decisions (organization_id, tender_id, bidder_id, decision, comment, officer_id)
         values ($1, $2, $3, $4, $5, $6)`,
        [user.organizationId, sampleQualifiedTenderId, sampleQualifiedBidderId, "Qualified", "SAMPLE DECISION: the seeded verification fixture is clear. A real procurement decision remains with the authorized officer.", user.id],
      );
    }
  });

}
