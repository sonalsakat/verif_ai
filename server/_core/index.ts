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

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

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

  app.get("/api/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Secure document preview endpoint for sandbox and private vault inspection
  app.get("/api/documents/preview/:key(*)", async (req, res) => {
    const rawKey = req.params.key;
    const { documentBufferCache } = await import("../document-processing");
    const cached = documentBufferCache.get(rawKey);

    if (cached) {
      res.setHeader("Content-Type", cached.mimeType || "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${cached.fileName.replace(/[\r\n"]/g, "_")}"`);
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
    const text = doc?.extracted_text || "No extracted text is stored for this document. Review the linked verification record for its evidence and result.";
    const isDemo = rawKey.startsWith("sih26-demo/") || fileName.startsWith("SAMPLE-");
    const safeFileName = escapeHtml(fileName);
    const safeDocType = escapeHtml(docType);
    const safeText = escapeHtml(text);
    const previewBadge = isDemo ? "DEMO / SAMPLE · FICTIONAL FIXTURE" : "PRIVATE EVIDENCE PREVIEW";
    const previewNotice = isDemo
      ? "Fictional readable text fixture only. This is not an official document or a live government-source response."
      : "Private document preview. This page alone does not establish an external source result or compliance decision.";
    const previewOwner = isDemo ? "DEMO / SAMPLE DATA<br><span>Not an official record</span>" : "VERIFAI PRIVATE WORKSPACE<br><span>Evidence preview only</span>";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
      <title>${safeFileName} · VerifAI Evidence Vault</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; display: flex; justify-content: center; }
          .viewer { max-width: 820px; width: 100%; background: #ffffff; color: #1e293b; border-radius: 12px; box-shadow: 0 25px 60px rgba(0,0,0,0.4); padding: 48px; border: 1px solid #cbd5e1; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 28px; }
          .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          h1 { margin: 10px 0 4px; font-size: 22px; color: #0f172a; }
          .meta { font-size: 12px; color: #64748b; }
          .watermark { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 12px 16px; border-radius: 8px; font-size: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; font-weight: 600; }
          .demo-watermark { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
          .preview-watermark { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
          .content { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; font-family: ui-monospace, Menlo, monospace; font-size: 13px; line-height: 1.7; white-space: pre-wrap; color: #334155; }
          .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="viewer">
          <div class="header">
            <div>
              <span class="badge">${previewBadge}</span>
              <h1>${safeFileName}</h1>
              <div class="meta">Document Classification: <strong>${safeDocType}</strong> · Private workspace preview</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #0284c7; font-weight: 700;">
              ${previewOwner}
            </div>
          </div>
          <div class="watermark ${isDemo ? "demo-watermark" : "preview-watermark"}">
            <span>ⓘ</span>
            <span>${previewNotice}</span>
          </div>
          <div class="content">${safeText}</div>
          <div class="footer">
            <span>VerifAI evidence preview · consult the associated PROVE IT record for the rule and result.</span>
            <span>No external digital seal is asserted on this page.</span>
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

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
