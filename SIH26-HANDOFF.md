# VerifAI · SIH 2026 implementation handoff

## What was completed

This continues the existing VerifAI application and reuses its React/Vite frontend, Express/tRPC backend, Supabase auth/role model, current schema, admin portal, and audit workflow. No duplicate application pages, auth system, or database tables were introduced.

### Demo workspace

A fresh, otherwise-empty workspace is populated idempotently with three fictional tenders and nine fictional bidders (three per tender). All have nine requirements in total and 27 stored verification checks. Tender deadlines/opening dates are relative to seed time, so they remain future-dated for a live demo.

| Demo tender | Verified | Needs Review | Pending Verification |
| --- | --- | --- | --- |
| Digital Radiography Systems · Maharashtra Health Services | Sahyadri Clinical Systems | Aarohan Medical Technologies · turnover certificate ₹11.20 Cr vs audited statements ₹8.70 Cr | Meridian Diagnostic Devices · GSTN sandbox did not return a status |
| Hospital Rooftop Solar & Battery Storage | Pragati Renewables India | Suryodaya Integrated Energy · bidder licence says valid through 2027 vs sample board record expired in 2024 | Vidyut Infra Services · licensing sandbox unavailable |
| City Surveillance & Command-Centre Equipment | Zenith Defense & Surveillance Solutions | Kavach Cybernetix · company certificate CIN differs from sample MCA21 record | Aster Secure Networks · CERT-In sandbox unavailable |

Tender descriptions, requirements, bidder submissions, sample documents, and government-source responses are identified as **Demo / Sample Data**. The data is fictional and must not be treated as an official tender, supplier, or registry record. The seed runs only when the workspace has no tenders; an existing procurement workspace is left untouched.

### PROVE IT evidence trace

The existing PROVE IT action now reads persisted verification/evidence records. It presents the requirement and requested submission, bidder claim, each document/source record, page/location, extracted value and supporting excerpt, rule applied, result, confidence, source availability, and the associated demo/workspace label. Contradictory records remain side-by-side for officer review. An unavailable source remains **Pending Verification**, not a negative compliance finding.

A server-computed SHA-256 fingerprint covers the stored evidence snapshot shown in the dossier. The UI explicitly says it is a content fingerprint, **not** a digital signature or externally anchored government seal. Sample document previews are labeled as fictional; the previous preview copy that asserted government validation was removed, and rendered text is HTML-escaped.

Re-running verification for a seeded sample bidder replays the saved sample findings without calling a live registry, preserves the existing 27 checks, and records the action in the audit trail. An initial sample officer decision is clearly marked as a sample decision; officers can use the existing UI to record their own decision.

### Compatibility and deployment preparation

- Embedded demo entity IDs now use UUIDs, matching the database and existing protected tRPC input validators. This makes the seeded items operable by existing UI actions instead of weakening route validation.
- Added `/api/healthz` for container liveness checks and a portable Node 22 `Dockerfile`/`.dockerignore`.
- Added [`DEPLOYMENT.md`](DEPLOYMENT.md) with container commands, environment variables, demo-mode persistence/auth limitations, and sandbox-source guidance.

## Demo walkthrough

1. Start locally using the existing scripts (`pnpm install --frozen-lockfile`, then `pnpm dev`) and use the existing Officer or Admin demo sign-in option.
2. Open **Tenders** and select one of the `DEMO-SIH26-*` tenders; inspect its requirements and three bidders.
3. From a verification result, choose **PROVE IT**. For example, open Aarohan’s turnover check to see both the CA certificate at page 2 (₹11.20 Cr) and the audited statement at page 6 (₹8.70 Cr).
4. Open Meridian’s GST check to show a submitted certificate alongside the unavailable GSTN sandbox response and the pending outcome.
5. Use the existing officer-decision flow and **Audit Trail** to demonstrate human review and recorded actions.

No live government API is required for this walkthrough. Keep the government connector URL/key variables empty unless approved sandbox endpoints have been deliberately configured.

## Validation performed

- `pnpm check` — passed.
- `pnpm test` — passed: 4 test files and 7 tests; 3 external-credential-dependent test files were skipped because Supabase/Gemini credentials are not present in this sandbox.
- `pnpm build` — passed; Vite emitted a non-blocking notice that the main JavaScript chunk is above 500 kB minified.
- `git diff --check` — passed.
- The new workflow regression test resolves the existing demo token and role, calls protected workspace tRPC procedures, verifies the 3/9/27 fixture counts and UUIDs, checks the conflicting page-level values and pending-source evidence, replays a sample verification, records a final officer decision, creates a tender/bidder/requirement through the existing routes, checks the audit write, and confirms existing tenders suppress demo seeding.
- Docker/Podman is not installed in this sandbox, so the Docker image itself could not be built or started here. No external Supabase/Gemini account was modified and no deployment was published.

## Important runtime boundary

Without configured Supabase variables, the built-in demo auth and embedded store are convenient for a controlled prototype presentation. Embedded records are process-local and re-seed after restart; do not use that mode for durable real procurement data or multiple replicas. For a persistent deployment, configure Supabase and sign in with actual Supabase Auth users; the static mock demo tokens are not provisioned as remote Supabase identities. Keep any government connector configured only for an approved sandbox.
