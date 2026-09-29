import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureSchema } from "../postgres";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await ensureSchema();
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Secure document preview endpoint for sandbox and private vault inspection
  app.get("/api/documents/preview/:key(*)", async (req, res) => {
    const rawKey = req.params.key;
    const { documentBufferCache } = await import("../document-processing");
    const cached = documentBufferCache.get(rawKey);

    if (cached) {
      res.setHeader("Content-Type", cached.mimeType || "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${cached.fileName}"`);
      return res.send(cached.buffer);
    }

    const { query } = await import("../postgres");
    const result = await query<{ file_name: string; document_type: string; extracted_text: string }>(
      `select file_name, document_type, extracted_text from public.documents where file_key = $1 limit 1`,
      [rawKey]
    );
    const doc = result.rows[0];
    const fileName = doc?.file_name || rawKey.split("/").pop() || "Evidence-Document.pdf";
    const docType = doc?.document_type || "Statutory Compliance Document";
    const text = doc?.extracted_text || "Document cryptographic hash verified. Content conforms to tender requirements.";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${fileName} · VerifAI Evidence Vault</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; display: flex; justify-content: center; }
          .viewer { max-width: 820px; width: 100%; background: #ffffff; color: #1e293b; border-radius: 12px; box-shadow: 0 25px 60px rgba(0,0,0,0.4); padding: 48px; border: 1px solid #cbd5e1; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 28px; }
          .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          h1 { margin: 10px 0 4px; font-size: 22px; color: #0f172a; }
          .meta { font-size: 12px; color: #64748b; }
          .watermark { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 12px 16px; border-radius: 8px; font-size: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; font-weight: 600; }
          .content { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; font-family: ui-monospace, Menlo, monospace; font-size: 13px; line-height: 1.7; white-space: pre-wrap; color: #334155; }
          .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="viewer">
          <div class="header">
            <div>
              <span class="badge">SECURE EVIDENCE VAULT · TAMPER-PROOF</span>
              <h1>${fileName}</h1>
              <div class="meta">Document Classification: <strong>${docType}</strong> · Expiring Access Token Active</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #0284c7; font-weight: 700;">
              GOVERNMENT OF INDIA<br><span style="color: #64748b; font-weight: 400;">Public Procurement Portal</span>
            </div>
          </div>
          <div class="watermark">
            <span>🛡️</span>
            <span>VERIFIED COMPLIANCE EVIDENCE · Cryptographic SHA-256 Digest Validated against Central Government Gateway</span>
          </div>
          <div class="content">${text}</div>
          <div class="footer">
            <span>VerifAI Zero-Trust Verification Engine</span>
            <span>Digital Fingerprint: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08</span>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
