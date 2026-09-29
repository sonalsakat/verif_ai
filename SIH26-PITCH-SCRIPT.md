# VerifAI — SIH 2026 screen-recording pitch

**Target length:** about 3 minutes 35 seconds at a calm speaking pace. Bracketed text is a screen/action cue, not narration.

---

## 0:00–0:30 · Opening

[Begin on the VerifAI sign-in page. Sign in using the existing Officer demo option.]

Hello, we’re presenting **VerifAI**—an evidence-backed procurement verification assistant built to help public procurement teams review tender submissions more clearly and consistently.

A tender can involve many requirements, bidder declarations, certificates and external checks. When those are spread across documents and spreadsheets, it can be difficult to spot a contradiction, explain a result, or show how a final decision was reached. VerifAI brings those steps into one reviewable workflow, while keeping the final decision with the authorized officer.

## 0:30–1:05 · Dashboard and tender

[Pause on the dashboard, then open **Tenders** and select the Maharashtra Health Services digital radiography tender.]

The dashboard gives an officer a quick view of the procurement workspace. From the tender list, we can open a tender, review its deadline and department, and see its requirements, bidders and verification progress together.

For this walkthrough, I’m using the digital radiography sample tender. Its requirements include active GST registration, an audited average annual turnover of at least ten crore rupees, and prior medical-equipment supply experience. Each requirement has the evidence expected and the rule used for review.

## 1:05–1:35 · Different bidder outcomes

[Open the bidder list for this tender. Point to the status column.]

The sample includes three different outcomes. Sahyadri Clinical Systems is marked **Verified**. Aarohan Medical Technologies is marked **Needs Review** because its financial documents disagree. Meridian Diagnostic Devices is **Pending Verification** because the sample GSTN source did not return a status.

Those distinctions matter: a discrepancy should be reviewed, and an unavailable source should not be mistaken for proof of non-compliance.

## 1:35–2:40 · PROVE IT

[Open Aarohan’s turnover result and click **PROVE IT**. Scroll slowly through the evidence trace.]

This is the part we call **PROVE IT**. It answers a practical question: why did VerifAI produce this result?

Start with the requirement: audited average annual turnover must be at least ten crore rupees. Aarohan’s claim is eleven crore twenty lakh. VerifAI then shows the supporting records—not just a score. The CA turnover certificate reports eleven crore twenty lakh on page two. The audited financial statement reports eight crore seventy lakh on page six.

Both values remain visible beside their source, page and supporting extract. The rule is shown next, followed by the **Needs Review** result. VerifAI does not silently choose the more favorable number or resolve the conflict on the officer’s behalf. The officer can see where each value came from and decide what follow-up is appropriate.

The dossier also displays a SHA-256 fingerprint of the evidence snapshot. That helps identify the stored content being reviewed; it is not represented as a government signature or an externally verified seal.

## 2:40–3:10 · Pending is not failure

[Close the dossier. Open Meridian’s GST check and its PROVE IT view.]

Here the bidder’s sample GST certificate says the registration is active, but the GSTN sandbox response is unavailable. VerifAI keeps the outcome **Pending Verification**. It explains that no authoritative status was returned and does not turn a missing response into an adverse finding.

## 3:10–3:40 · Human decision and audit trail

[Show the officer decision action, then open **Audit Trail**.]

After reviewing the evidence, an authorized officer can record a final qualification decision and a comment. That action is persisted and appears in the audit trail, so the review has a visible human owner and a record of what happened.

VerifAI’s goal is not to replace judgment. It is to make procurement checks easier to inspect, explain and audit—from requirement, to claim, to evidence, to officer decision.

## 3:40–3:55 · Close

[Return to the dashboard or tender overview.]

The tender and bidder records in this recording are clearly marked **fictional SIH demo data**. Government-source entries are built-in sandbox fixtures; this walkthrough does not call live government registries. VerifAI demonstrates how transparent evidence review can support a more accountable procurement process. Thank you.

---

## Quick recording notes

- Move the cursor deliberately and pause on the two turnover values and their page numbers.
- Keep the PROVE IT scroll slow enough for viewers to read the rule and result.
- Use the demo sign-in. Do not show secret keys, personal accounts or real bidder documents.
- The script says **sandbox fixture** rather than **live integration** because the demo dataset is fictional and does not make live government API calls.
