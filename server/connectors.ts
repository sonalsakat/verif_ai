import { query } from "./postgres";

const connectorEnv: Record<string, { url?: string; key?: string }> = {
  "Udyam / MSME": { url: process.env.UDYAM_API_URL, key: process.env.UDYAM_API_KEY },
  GSTN: { url: process.env.GSTN_API_URL, key: process.env.GSTN_API_KEY },
  "PAN / Income Tax": { url: process.env.INCOME_TAX_API_URL, key: process.env.INCOME_TAX_API_KEY },
  MCA21: { url: process.env.MCA21_API_URL, key: process.env.MCA21_API_KEY },
  "Startup India": { url: process.env.STARTUP_INDIA_API_URL, key: process.env.STARTUP_INDIA_API_KEY },
  NSIC: { url: process.env.NSIC_API_URL, key: process.env.NSIC_API_KEY },
  "EPFO / ESIC": { url: process.env.EPFO_ESIC_API_URL, key: process.env.EPFO_ESIC_API_KEY },
  EPFO: { url: process.env.EPFO_API_URL, key: process.env.EPFO_API_KEY },
  ESIC: { url: process.env.ESIC_API_URL, key: process.env.ESIC_API_KEY },
  DigiLocker: { url: process.env.DIGILOCKER_API_URL, key: process.env.DIGILOCKER_API_KEY },
  "Make in India": { url: process.env.MAKE_IN_INDIA_API_URL, key: process.env.MAKE_IN_INDIA_API_KEY },
  "BIS / DPIIT": { url: process.env.BIS_DPIIT_API_URL, key: process.env.BIS_DPIIT_API_KEY },
  "Blacklisting / Debarment": { url: process.env.DEBARMENT_API_URL, key: process.env.DEBARMENT_API_KEY },
  GeM: { url: process.env.GEM_API_URL, key: process.env.GEM_API_KEY },
};

function configuredSourceStatus(name: string): "Live Connected" | "Sandbox Connected" {
  const config = connectorEnv[name];
  return config?.url && config.key ? "Live Connected" : "Sandbox Connected";
}

export async function getConnectorRegistry(organizationId: string): Promise<{ rows: Array<Record<string, unknown>> }> {
  const result = await query(`select id, name, description, status, last_checked as "lastChecked" from public.government_sources where organization_id = $1 order by created_at`, [organizationId]);
  const rows = result.rows as Array<Record<string, unknown>>;
  return {
    rows: rows.map((row) => ({
      ...row,
      status: configuredSourceStatus(String(row.name)),
      configurationState: configuredSourceStatus(String(row.name)),
      lastChecked: row.lastChecked ? new Date(String(row.lastChecked)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Active (Sandbox)",
    })),
  };
}

export function getSandboxGovernmentResponse(name: string, payload: Record<string, unknown>) {
  const queryStr = JSON.stringify(payload).toLowerCase();
  const isFlagged = queryStr.includes("nexus") || queryStr.includes("debarred") || queryStr.includes("blacklist");

  switch (name) {
    case "GSTN":
      if (isFlagged) {
        return {
          gstin: payload.gstin || "07AABCN9921B1Z3",
          legalName: payload.name || "Nexus Power & Infraworks Corp",
          status: "Cancelled Suo-Moto",
          reason: "Non-filing of statutory GSTR-3B returns for 6+ consecutive tax periods",
          dateOfCancellation: "2024-08-14",
          taxpayerType: "Regular",
          activeFiling: false,
          verificationVerdict: "FAIL - Registration Cancelled / Inactive Taxpayer",
        };
      }
      return {
        gstin: payload.gstin || "27AAMCS7421G1Z4",
        legalName: payload.name || "Sahyadri Clinical Systems Pvt. Ltd.",
        tradeName: "Sahyadri Clinical Systems",
        status: "Active",
        taxpayerType: "Regular Taxpayer",
        constitutionOfBusiness: "Private Limited Company",
        dateOfRegistration: "2017-07-01",
        centerJurisdiction: "Commissionerate Pune-I, Range-IV",
        stateJurisdiction: "Maharashtra State Tax Ward 204",
        returnsSummary: [
          { returnType: "GSTR-1", period: "Jan-2026", status: "Filed", arn: "AA2701260192837", filingDate: "2026-02-10" },
          { returnType: "GSTR-3B", period: "Jan-2026", status: "Filed", arn: "AA2701260281920", filingDate: "2026-02-18" },
          { returnType: "GSTR-9 (Annual)", period: "FY 2024-25", status: "Filed", arn: "AA2712250918231", filingDate: "2025-12-28" },
        ],
        eInvoiceEnabled: true,
        verificationVerdict: "PASS - Active Registered Taxpayer with Up-to-Date Filings",
      };

    case "Udyam / MSME":
      return {
        udyamRegistrationNumber: payload.registrationId || "UDYAM-MH-18-0048217",
        enterpriseName: payload.name || "Sahyadri Clinical Systems Pvt. Ltd.",
        enterpriseType: "Small Enterprise",
        majorActivity: "Manufacturing",
        organizationType: "Private Limited",
        dateOfIncorporation: "2018-04-12",
        dateOfUdyamRegistration: "2020-08-15",
        dicDistrict: "Pune, Maharashtra",
        nicCode: "3250 - Manufacture of medical and dental instruments and supplies",
        nationalPublicProcurementBenefits: {
          emdExemptionEligible: true,
          tenderFeeExemptionEligible: true,
          purchasePreferencePercent: 25,
        },
        verificationVerdict: "PASS - Valid MSME Udyam Certificate on National Portal",
      };

    case "PAN / Income Tax":
      return {
        pan: payload.pan || "AAMCS7421G",
        panStatus: "Valid and Operative",
        nameAsPerPAN: payload.name || "Sahyadri Clinical Systems Pvt. Ltd.",
        aadhaarLinkage: "Linked & Verified",
        itrFilingsVerified: [
          { assessmentYear: "2025-26", eFilingAckNo: "918273645012", filingDate: "2025-10-14", status: "Processed" },
          { assessmentYear: "2024-25", eFilingAckNo: "819283746102", filingDate: "2024-09-28", status: "Processed" },
          { assessmentYear: "2023-24", eFilingAckNo: "710293847561", filingDate: "2023-10-02", status: "Processed" },
        ],
        section206ABSpecifiedPerson: "No - Compliant Regular Filer",
        verificationVerdict: "PASS - PAN Valid with 3-Year Verified ITR Track Record",
      };

    case "MCA21":
      return {
        cin: "U33110MH2018PTC308912",
        companyName: payload.name || "Sahyadri Clinical Systems Pvt. Ltd.",
        companyStatus: "Active",
        companyCategory: "Company limited by Shares",
        companySubCategory: "Non-govt company",
        classOfCompany: "Private",
        dateOfIncorporation: "2018-04-12",
        authorizedCapital: "₹5,00,00,000",
        paidUpCapital: "₹2,80,00,000",
        registeredAddress: "Plot No. B-14, MIDC Chakan Phase-II, Pune, Maharashtra 410501",
        activeCompliance: "ACTIVE Compliant (Form INC-22A verified)",
        directors: [
          { din: "08192837", name: "Rajesh S. Kulkarni", status: "Active - No Disqualification" },
          { din: "08192838", name: "Sunita R. Kulkarni", status: "Active - No Disqualification" },
        ],
        verificationVerdict: "PASS - Company in Good Standing on Ministry of Corporate Affairs",
      };

    case "Startup India":
      return {
        dpiitRecognitionNo: "DIPP120938",
        entityName: payload.name || "Kavach Cybernetix Pvt. Ltd.",
        certificateDate: "2024-02-11",
        validThrough: "2034-02-10",
        sector: "Artificial Intelligence & Public Safety Hardware",
        publicProcurementExemptionGranted: true,
        exemptionScope: "Exemption from Prior Turnover & Prior Experience under GFR Rule 170(i)",
        verificationVerdict: "PASS - Recognized DPIIT Startup Entitled to Procurement Exemptions",
      };

    case "Blacklisting / Debarment":
      if (isFlagged) {
        return {
          debarmentStatus: "FLAGGED / BLACKLISTED",
          severity: "Critical",
          debarmentOrderNo: "CVC/DEB/2024/019",
          issuingAuthority: "Ministry of Power / Central Vigilance Commission",
          partyName: payload.name || "Nexus Power & Infraworks Corp",
          reasonForDebarment: "Submission of forged bank guarantee and wilful contractual default",
          debarmentPeriod: "14-Jan-2024 to 13-Jan-2027",
          recommendation: "STRICT DISQUALIFICATION under Rule 151(iii) GFR 2017",
          verificationVerdict: "FAIL - ACTIVE DEBARMENT RECORD FOUND ON NATIONAL REPOSITORY",
        };
      }
      return {
        debarmentStatus: "CLEARED - NIL RECORDS FOUND",
        severity: "None",
        cvcRegistryCheck: "Clean - No records found across 48 Central Ministries",
        gemIncidentManagementCheck: "0 Active Incidents / 0 Cautions",
        stateDebarmentCheck: "Clean across Government of Maharashtra databases",
        recommendation: "Eligible for public tender award",
        verificationVerdict: "PASS - Bidder is Not Debarred or Blacklisted",
      };

    case "Make in India":
      return {
        bidderClassification: "Class-I Local Supplier",
        verifiedLocalContent: "58.4%",
        minimumThresholdRequired: "50.0%",
        locationOfValueAddition: "MIDC Chakan Phase-II, Pune, Maharashtra",
        auditorCertification: "Certified by CA S. K. Mehta & Associates (UDIN: 25048217AAAA0192)",
        pmiOrderCompliance: "Compliant with DPIIT Public Procurement Order 2017 (revised 2020)",
        verificationVerdict: "PASS - Class-I Local Supplier Margin of Purchase Preference Applicable",
      };

    case "DigiLocker":
      return {
        docRefId: "DL-GOV-IN-918204820",
        issuerOrganization: "Ministry of Electronics & Information Technology (MeitY)",
        cryptographicSignature: "Valid - Certified by CCA India (eSign Service)",
        sha256Digest: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        tamperVerification: "100% Intact - Hash matches Government Repository Root",
        verificationVerdict: "PASS - Authentic Government Issued Digital Document",
      };

    case "BIS / DPIIT":
      return {
        licenseNumber: "CM/L-8192837",
        standardApplicable: "IS/ISO 13485:2016 (Medical Devices Quality Management)",
        scope: "Design, Manufacture and Distribution of Medical Radiography Equipment",
        licenseValidity: "Valid through 31-Dec-2027",
        nablLabReportRef: "NABL/PUN/2025/REP-8491 (All Type-Tests Cleared)",
        verificationVerdict: "PASS - Active BIS License and Conformity Assessment",
      };

    case "GeM":
      return {
        gemSellerId: "GEM-SELLER-MH-81920",
        sellerRating: "4.8 / 5.0",
        ordersDelivered: 314,
        onTimeDeliveryRatio: "98.7%",
        cautionNotices: 0,
        oemVerified: true,
        verificationVerdict: "PASS - Verified GeM Prime Vendor with Exemplary Track Record",
      };

    default:
      return {
        registry: name,
        verificationTimestamp: new Date().toISOString(),
        status: "Active Verified",
        payloadReceived: payload,
        verificationVerdict: `PASS - Verified against Simulated ${name} National Database Gateway`,
      };
  }
}

export async function verifyGovernmentSource(name: string, payload: Record<string, unknown>) {
  const config = connectorEnv[name];
  if (config?.url && config.key) {
    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}`, "X-Client": "VerifAI" },
        body: JSON.stringify(payload),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`${name} connector responded ${response.status}: ${body.slice(0, 240)}`);
      return {
        status: "Live Connected" as const,
        live: true,
        sandbox: false,
        message: `Live ${name} verified response received.`,
        data: JSON.parse(body) as unknown,
      };
    } catch (err) {
      console.warn(`[Connector] Live ${name} check failed, falling back to sandbox:`, err);
    }
  }

  // Sandbox simulation response
  const sandboxData = getSandboxGovernmentResponse(name, payload);
  return {
    status: "Sandbox Connected" as const,
    live: false,
    sandbox: true,
    message: `[Sandbox] Verified against simulated ${name} Government Gateway.`,
    data: sandboxData,
  };
}
