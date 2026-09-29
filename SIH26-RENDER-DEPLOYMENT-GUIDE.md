# Deploy VerifAI on Render — step by step

This guide deploys the **existing VerifAI app** as a Render Web Service using the included root-level `Dockerfile`. The Dockerfile serves the React frontend and Express/tRPC API together. You do not need to install Docker on your Windows computer; Render builds the image.

> I have not pushed the prepared project archive to GitHub or created a Render service. These steps publish it from your own accounts.

## What you need

- A GitHub account with permission to update `sonalsakat/verif_ai` (or a new repository you own).
- A Render account.
- For the sample-only demo, no API keys are required.
- For durable real workspace data/auth, a Supabase project and its credentials are required; see Step 5.

## Step 1 — Put the prepared project on GitHub

The prepared archive is available in this conversation as **VerifAI SIH 2026 project archive**. It excludes `.git`, `node_modules`, build output and private `.env` files.

### Easiest on Windows: GitHub Desktop

1. Install/open [GitHub Desktop](https://desktop.github.com/).
2. Choose **File → Clone repository**, select `sonalsakat/verif_ai`, and clone it to your computer.
3. Download and extract the prepared project ZIP to a temporary folder.
4. Copy the ZIP's contents into the cloned `verif_ai` folder. Approve replacing files when asked. **Keep the existing `.git` folder** in the cloned repository; the ZIP does not contain it.
5. Do not copy in a private `.env` file, API keys, database passwords, or service-role keys.
6. In GitHub Desktop, review the changed files. Create a branch such as `sih26-deploy`, enter a commit summary such as `Prepare VerifAI SIH demo deployment`, click **Commit**, then **Push origin**.

If you prefer command line, clone the repo, copy the extracted files into the clone (without deleting `.git`), then run:

```sh
git checkout -b sih26-deploy
git status --short
git add -A
git commit -m "Prepare VerifAI SIH demo deployment"
git push -u origin sih26-deploy
```

If you committed directly to `main`, select `main` in Render instead. Never commit `.env` or secret values; use `.env.example` only as a list of variable names.

## Step 2 — Create the Render Web Service

1. Sign in to [Render](https://dashboard.render.com/).
2. Select **New + → Web Service**. Choose Web Service, **not Static Site**; VerifAI needs its Express/tRPC backend as well as its frontend.
3. Connect your GitHub account if Render asks, then choose `sonalsakat/verif_ai`.
4. Select the branch you pushed (`sih26-deploy` or `main`).
5. In the service setup form, use:
   - **Name:** `verifai-sih26` (or another available name)
   - **Language/Runtime:** `Docker`
   - **Root Directory:** leave blank (the Dockerfile is at the repository root)
   - **Dockerfile Path:** `Dockerfile`
   - **Docker Command:** leave blank so the image's existing startup command is used
6. Choose a region and compute plan. Review the plan's limits before creating the service.
7. Under **Advanced → Health Check Path**, enter:
   ```text
   /api/healthz
   ```
8. Create the Web Service and watch its **Events/Logs** until the first deploy is marked live.

The repository already has a Node 22 multi-stage Dockerfile. Render builds it from the connected Git branch. The app binds to `0.0.0.0` and uses Render's `PORT` environment variable; you should not need to set a separate port or custom build/start command.

## Step 3 — Start with the fictional demo data

For a SIH walkthrough using the built-in sample data:

- Leave Supabase, Gemini and government connector variables unset.
- Do not create a `.env` file just for the demo.
- Open the `https://<your-service-name>.onrender.com` URL shown on the Render service page.
- Check `https://<your-service-name>.onrender.com/api/healthz`; it should return JSON with `"status":"ok"`.
- Sign in using the existing Officer or Admin demo option, open a `DEMO-SIH26-*` tender, and use **PROVE IT** to show the evidence chain.

The tenders, bidders, document extracts and government-source responses are fictional SIH fixtures. The demo does not call live government registries. The embedded demo workspace is in memory, so officer edits do not provide durable records across restarts.

## Step 4 — Understand the free-service trade-off

Render's current free Web Services can be useful for a prototype, but Render documents that they spin down after 15 minutes without traffic and can take about a minute to wake on a new request. Free services can also restart, and their local files are ephemeral. This app's demo workspace is process-local, so use free mode for a showcase—not for durable production records or a promise of always-instant access.

For a continuously available public demo, select a suitable always-on service plan. For persistent accounts and procurement records, configure Supabase as described below. Review Render's current plan limits in your dashboard before choosing.

## Step 5 — Optional: add persistent Supabase data and real users

Only do this if you want user accounts and data to persist beyond the in-memory demo. In Render, open the service's **Environment** page and add the values from your Supabase project as environment variables:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
PUBLIC_APP_URL=https://<your-service-name>.onrender.com
```

The first four values come from your Supabase project. `PUBLIC_APP_URL` is the deployed public origin used for auth callbacks. The server attempts to apply the included `server/schema.sql` when it starts with a configured Postgres connection.

Then create/authorize actual users in Supabase Auth and assign the intended VerifAI roles. The built-in mock Officer/Admin demo sign-ins are for embedded demo mode; they are not automatically created as Supabase Auth accounts. Keep the service-role key and database connection string only in Render's private Environment settings—never in GitHub, source code, or chat. Save changes and let Render redeploy.

## Step 6 — Optional: enable Gemini document extraction

Add `GEMINI_API_KEY` under the Render service's **Environment** page if you want Gemini OCR/classification for uploaded documents. The Gemini endpoint is already configured in the application, so no Gemini URL is needed. Without the key, the app uses filename-based demo heuristics; do **not** treat those fallback results as authoritative document extraction.

Keep all government connector URL/key variables blank unless you have approved sandbox endpoints and credentials. Never point the SIH demo at a production government registry.

## Step 7 — Confirm automatic deploys and add a domain if desired

- Render can deploy the selected branch automatically after each GitHub push. Push later code changes to that branch and watch the Render **Events/Logs**.
- Render provides an `onrender.com` URL. Test the home page, `/api/healthz`, demo sign-in, and PROVE IT dossier.
- Optional custom domain: in the service settings, add your domain and follow the exact DNS records Render displays at your domain registrar; wait for domain verification and TLS before sharing it.

## Useful official references

- [Render Web Services](https://render.com/docs/web-services)
- [Deploying Docker on Render](https://render.com/docs/docker)
- [Render Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)
- [Render Health Checks](https://render.com/docs/health-checks)
- [Render Free Service Limitations](https://render.com/docs/free)
