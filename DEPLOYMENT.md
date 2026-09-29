# VerifAI SIH 2026 deployment notes

## Container

The repository includes a Node 22 container definition for its existing Vite frontend and Express/tRPC backend. Build and run it with Docker:

```sh
docker build -t verifai:sih26 .
# Demo mode: no credentials or .env file required
docker run --rm -p 3000:3000 verifai:sih26
# Persistent Supabase mode: create a private .env from .env.example first
docker run --rm -p 3000:3000 --env-file .env verifai:sih26
```

The container serves the compiled frontend and API from one origin. `PORT` is honored by the server; `/api/healthz` is a liveness endpoint. The image does not contain a `.env` file or any service credentials.

## Runtime configuration

For a persistent workspace backed by Supabase, set the server-side values from `.env.example` in the hosting provider's secret manager: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL`. Set `PUBLIC_APP_URL` to the deployed origin for authentication callbacks. `GEMINI_API_KEY` is optional for document AI; the existing extractor falls back to its local heuristic path when unset. Do not put service-role keys in `VITE_*` variables or commit them.

When those Supabase settings are absent, VerifAI intentionally runs in its embedded demo store. The built-in fictional officer/admin sign-ins and the seeded SIH sample workspace are intended for a controlled prototype walkthrough. Embedded data is process-local: it is re-seeded after a restart and is not shared between replicas. Do not use embedded mode for durable production records or scale it horizontally.

The static demo tokens are mock-mode accounts, not Supabase Auth users. For a persistent Supabase deployment, sign in with an actual Supabase-authenticated account (or provision the demo accounts as real Supabase users before the event); the code does not create remote demo identities or passwords automatically.

## Government source behavior

The 3 demo tenders, 9 bidders, and proof records are fictional fixtures. Source rows explicitly say **sandbox fixture**, **unavailable**, or **not a live lookup**. The demo verification replay reads these persisted sample checks and appends an audit entry; it does not make a government API call. Keep the government API endpoint/key variables empty for the SIH showcase unless the team has deliberately configured approved sandbox endpoints. Never point this demo at a production registry during the presentation.

## Verification available in this handoff

`pnpm check`, `pnpm test`, and `pnpm build` are the repository checks. The sandbox used for this handoff does not include Docker/Podman, so the Docker image itself could not be built here; the application build and server bundle were validated independently.
