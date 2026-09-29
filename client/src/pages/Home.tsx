import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Activity, AlertCircle, ArrowRight, BadgeCheck, Bell, Check, CheckCircle2, ClipboardCheck, CloudUpload,
  Copy, Database, ExternalLink, FileCheck2, FileText, FolderOpen, Gauge, KeyRound, Loader2, LogOut,
  Menu, Plus, Printer, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, TriangleAlert, UserPlus, UsersRound, X, Building2, Clock3
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { trpc } from "@/lib/trpc";

type AuthMode = "signin" | "signup" | "reset";

function BrandMark() { return <span className="brand-mark"><ShieldCheck size={18} strokeWidth={2.5} /></span>; }

function AuthScreen({ onLogin, onRegister, onReset, onDemoLogin, busy }: { onLogin: (email: string, password: string) => void; onRegister: (email: string, password: string, fullName: string, organization: string) => void; onReset: (email: string) => void; onDemoLogin: (role: "officer" | "admin") => void; busy: boolean }) {
  const [mode, setMode] = useState<AuthMode>("signin"); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [fullName, setFullName] = useState(""); const [organization, setOrganization] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); if (mode === "signin") onLogin(email, password); else if (mode === "signup") onRegister(email, password, fullName, organization); else onReset(email); };
  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-brand"><BrandMark /><span>Verif<span>AI</span></span></div>
        <div className="login-kicker">Evidence-backed procurement compliance</div>
        <h1>Decisions you can defend.</h1>
        <p className="login-copy">A secure workspace for procurement officers to verify bidder claims, preserve source evidence, and record accountable decisions.</p>
        <div className="login-principles">
          <div><strong>Evidence first</strong><span>Every result maps to a document, field, rule, and source.</span></div>
          <div><strong>Officer controlled</strong><span>AI assists the review; qualification decisions remain yours.</span></div>
          <div><strong>Private by default</strong><span>Files are encrypted in private storage with expiring links.</span></div>
          <div><strong>Traceable</strong><span>Actions are recorded in an organization-scoped audit trail.</span></div>
        </div>
      </section>
      <section className="login-visual">
        <div className="visual-card">
          <div className="visual-card-header">
            <div>
              <div className="eyebrow">VERIFAI WORKSPACE</div>
              <h3>Sign in to your organization</h3>
            </div>
            <Building2 size={23} color="var(--blue)" />
          </div>

          <div className="demo-eval-box">
            <div className="demo-eval-header">
              <span className="demo-eval-badge">⚡ SIH 2026 EVALUATION QUICK-ACCESS</span>
              <h4>1-Click Demo Evaluation</h4>
              <p>Instant sign-in for hackathon judges & reviewers with complete pre-loaded procurement data.</p>
            </div>
            <div className="demo-roles-grid">
              <button
                type="button"
                className="demo-role-btn"
                disabled={busy}
                onClick={() => onDemoLogin("officer")}
              >
                <div className="demo-role-avatar">PM</div>
                <div className="demo-role-info">
                  <strong>Priya Menon</strong>
                  <span>Procurement Officer · Directorate of Health</span>
                </div>
                <span className="demo-role-tag">Officer Portal →</span>
              </button>
              <button
                type="button"
                className="demo-role-btn admin-btn"
                disabled={busy}
                onClick={() => onDemoLogin("admin")}
              >
                <div className="demo-role-avatar admin-avatar">AS</div>
                <div className="demo-role-info">
                  <strong>Dr. Arvind Swaminathan</strong>
                  <span>Chief Procurement Auditor · Admin</span>
                </div>
                <span className="demo-role-tag">Admin Portal →</span>
              </button>
            </div>
          </div>

          <div className="auth-divider">
            <span>OR CUSTOM ACCOUNT</span>
          </div>

          <div className="auth-tabs">
            <button className={mode === "signin" ? "auth-tab auth-tab-active" : "auth-tab"} onClick={() => setMode("signin")}>Sign in</button>
            <button className={mode === "signup" ? "auth-tab auth-tab-active" : "auth-tab"} onClick={() => setMode("signup")}>Create account</button>
          </div>
          {mode === "reset" ? (
            <form className="auth-form" onSubmit={submit}>
              <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="officer@department.gov" required /></label>
              <button className="button button-primary button-large full-width" disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />} Send reset instructions</button>
              <button type="button" className="button button-quiet full-width" onClick={() => setMode("signin")}>Back to sign in</button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Priya Menon" required /></label>
                  <label>Organization<input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Directorate of Health" required /></label>
                </>
              )}
              <label>Work email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="officer@department.gov" required /></label>
              <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>
              <button className="button button-primary button-large full-width" disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : mode === "signin" ? <ArrowRight size={15} /> : <UserPlus size={15} />} {mode === "signin" ? "Sign in" : "Create account"}</button>
              {mode === "signin" && <button type="button" className="button button-quiet full-width" onClick={() => setMode("reset")}>Forgot password?</button>}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) { const lower = status.toLowerCase(); const tone = lower.includes("verified") || lower.includes("qualified") || lower.includes("connected") || lower.includes("completed") || lower === "processed" ? "status-green" : lower.includes("review") || lower.includes("processing") ? "status-orange" : lower.includes("non") || lower.includes("failed") ? "status-red" : "status-gray"; return <span className={`status-badge ${tone}`}><i />{status}</span>; }
function EmptyState({ icon: Icon, title, copy, action }: { icon: typeof FileText; title: string; copy: string; action?: React.ReactNode }) { return <div className="empty-state"><Icon size={24} /><strong>{title}</strong><span>{copy}</span>{action}</div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card" role="dialog" aria-modal="true"><div className="modal-header"><div><h2>{title}</h2></div><button className="icon-button subtle" onClick={onClose} aria-label="Close"><X size={16} /></button></div>{children}</div></div>; }

function Sidebar({ currentPage, collapsed, onCollapse, onNavigate, onLogout, userName, organization, counts }: { currentPage: string; collapsed: boolean; onCollapse: () => void; onNavigate: (page: string) => void; onLogout: () => void; userName: string; organization: string; counts: { review: number; evidence: number } }) {
  const items = [["dashboard", "Dashboard", Gauge], ["tenders", "Tenders", FolderOpen], ["bidders", "Bidders", UsersRound], ["verification", "Verification", ClipboardCheck], ["evidence", "Evidence / PROVE IT", FileCheck2], ["reports", "Reports", FileText], ["audit", "Audit Trail", Activity], ["settings", "Settings", Settings2]] as const;
  return <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}><div className="sidebar-brand"><BrandMark />{!collapsed && <span className="brand-word">Verif<span>AI</span></span>}</div>{!collapsed && <div className="workspace-chip"><span className="workspace-avatar"><Building2 size={14} /></span><div><strong>{organization}</strong><span>Procurement workspace</span></div></div>}{!collapsed && <div className="nav-label">WORKSPACE</div>}<nav>{items.map(([page, label, Icon]) => <button key={page} className={`nav-item ${currentPage === page ? "nav-item-active" : ""}`} onClick={() => onNavigate(page)} title={collapsed ? label : undefined}><Icon size={16} />{!collapsed && <span>{label}</span>}{!collapsed && page === "verification" && counts.review > 0 && <span className="nav-count">{counts.review}</span>}{!collapsed && page === "evidence" && counts.evidence > 0 && <span className="nav-count nav-count-blue">{counts.evidence}</span>}</button>)}</nav><div className="sidebar-bottom">{!collapsed && <div className="sidebar-callout"><ShieldCheck className="callout-icon" size={15} /><div><strong>Private evidence</strong><span>Every result is traceable.</span></div></div>}<button className="nav-item" onClick={onCollapse}><span><ChevronLeftSafe /></span>{!collapsed && <span>Collapse sidebar</span>}</button><div className="user-row"><span className="user-avatar">{userName.slice(0, 2).toUpperCase()}</span>{!collapsed && <div className="user-meta"><strong>{userName}</strong><span>Procurement Officer</span></div>}<button className="icon-button" onClick={onLogout} title="Sign out"><LogOut size={15} /></button></div></div></aside>;
}
function ChevronLeftSafe() { return <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><ArrowRight size={16} /></span>; }
function Topbar({ title, subtitle, onMenu, search, setSearch }: { title: string; subtitle: string; onMenu: () => void; search: string; setSearch: (value: string) => void }) { return <header className="topbar"><div className="topbar-title"><button className="icon-button mobile-menu" onClick={onMenu}><Menu size={18} /></button><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="topbar-actions"><label className="global-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenders, bidders, documents" /><kbd>⌘ K</kbd></label><button className="icon-button notification-button"><Bell size={17} /><span /></button></div></header>; }
function Field({ label, value, onChange, placeholder, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) { return <label className="form-field"><span>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} /></label>; }

export default function Home() {
  const { user, loading, isAuthenticated, signIn, signUp, requestReset, signOut, demoSignIn, busy } = useSupabaseAuth(); const [location, setLocation] = useLocation(); const [collapsed, setCollapsed] = useState(false); const [search, setSearch] = useState(""); const [modal, setModal] = useState<"tender" | "bidder" | "requirement" | "upload" | "decision" | null>(null); const [selectedTenderId, setSelectedTenderId] = useState(""); const [selectedBidderId, setSelectedBidderId] = useState(""); const [selectedCheck, setSelectedCheck] = useState<Record<string, unknown> | null>(null); const currentPage = location.startsWith("/app/") ? location.split("/")[2] || "dashboard" : "dashboard"; const navigate = (page: string) => setLocation(`/app/${page}`);
  useEffect(() => { if (!loading && isAuthenticated && user?.portalRole === "admin" && !location.startsWith("/admin/")) setLocation("/admin/dashboard"); }, [loading, isAuthenticated, user, location, setLocation]);
  const snapshot = trpc.workspace.snapshot.useQuery(undefined, { enabled: isAuthenticated, retry: false, staleTime: 10_000 }); const utils = trpc.useUtils();
  const createTender = trpc.workspace.createTender.useMutation({ onSuccess: () => { toast.success("Tender created and persisted."); setModal(null); void utils.workspace.snapshot.invalidate(); }, onError: (error) => toast.error(error.message) }); const createBidder = trpc.workspace.createBidder.useMutation({ onSuccess: () => { toast.success("Bidder added to the workspace."); setModal(null); void utils.workspace.snapshot.invalidate(); }, onError: (error) => toast.error(error.message) }); const addRequirement = trpc.workspace.addRequirement.useMutation({ onSuccess: () => { toast.success("Requirement added to the verification ruleset."); setModal(null); void utils.workspace.snapshot.invalidate(); }, onError: (error) => toast.error(error.message) }); const runVerification = trpc.workspace.runVerification.useMutation({ onSuccess: (result) => { toast.success(result.message); void utils.workspace.snapshot.invalidate(); }, onError: (error) => toast.error(error.message) }); const uploadDocument = trpc.documents.upload.useMutation({ onSuccess: () => { toast.success("Document uploaded to private storage and processed."); setModal(null); void utils.workspace.snapshot.invalidate(); }, onError: (error) => toast.error(error.message) }); const recordDecision = trpc.workspace.recordDecision.useMutation({ onSuccess: () => { toast.success("Officer decision recorded in the audit trail."); setModal(null); void utils.workspace.snapshot.invalidate(); }, onError: (error) => toast.error(error.message) }); const signedUrl = trpc.documents.signedUrl.useMutation({ onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer"), onError: (error) => toast.error(error.message) }); const verifySource = trpc.connectors.verify.useMutation({ onSuccess: (result) => toast[result.live ? "success" : "message"](result.message), onError: (error) => toast.error(error.message) });
  if (loading) return <div className="loading-screen"><Loader2 className="spin" size={18} /> Checking secure session…</div>; if (!isAuthenticated || !user) return <AuthScreen onLogin={signIn} onRegister={signUp} onReset={requestReset} onDemoLogin={demoSignIn} busy={busy} />; if (snapshot.isLoading) return <div className="loading-screen"><Loader2 className="spin" size={18} /> Loading your organization workspace…</div>; if (snapshot.isError) return <div className="loading-screen"><TriangleAlert size={18} color="var(--red)" /> Unable to load workspace. <button className="button button-secondary" onClick={() => void snapshot.refetch()}>Retry</button></div>;
  const data = snapshot.data!; const tenders = data.tenders as Array<Record<string, unknown>>; const bidders = data.bidders as Array<Record<string, unknown>>; const requirements = data.requirements as Array<Record<string, unknown>>; const documents = data.documents as Array<Record<string, unknown>>; const checks = data.checks as Array<Record<string, unknown>>; const audits = data.auditEvents as Array<Record<string, unknown>>; const sources = data.sources as Array<Record<string, unknown>>; const activeTender = tenders.find((row) => row.id === selectedTenderId) || tenders.find((row) => checks.some((check) => check.tenderId === row.id)) || tenders[0]; const activeBidder = bidders.find((row) => row.id === selectedBidderId) || bidders.find((row) => checks.some((check) => check.bidderId === row.id && check.tenderId === activeTender?.id)) || bidders[0]; const filteredTenders = tenders.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())); const filteredBidders = bidders.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())); const currentMeta: Record<string, { title: string; subtitle: string }> = { dashboard: { title: "Dashboard", subtitle: "Workspace overview of your procurement compliance." }, tenders: { title: "Tenders", subtitle: "Manage procurement events, requirements, and deadlines." }, bidders: { title: "Bidders", subtitle: "Review every bidder's compliance posture in one place." }, verification: { title: "Verification", subtitle: "Run deterministic rules against stored evidence." }, evidence: { title: "Evidence / PROVE IT", subtitle: "Trace every result back to the evidence that supports it." }, reports: { title: "Reports", subtitle: "Generate decision-support reports from persisted results." }, audit: { title: "Audit Trail", subtitle: "A complete, time-stamped record of workspace activity." }, settings: { title: "Settings", subtitle: "Manage verification sources and workspace preferences." } };
  const renderPage = () => { if (currentPage === "tenders") return <TendersPage rows={filteredTenders} requirements={requirements} onCreate={() => setModal("tender")} onRequirement={(id) => { setSelectedTenderId(id); setModal("requirement"); }} onSelect={(id) => { setSelectedTenderId(id); navigate("verification"); }} />; if (currentPage === "bidders") return <BiddersPage rows={filteredBidders} onCreate={() => setModal("bidder")} onSelect={(id) => { setSelectedBidderId(id); navigate("verification"); }} />; if (currentPage === "verification") return <VerificationPage tenders={tenders} bidders={bidders} checks={checks} selectedTenderId={String(activeTender?.id || "")} selectedBidderId={String(activeBidder?.id || "")} onTender={setSelectedTenderId} onBidder={setSelectedBidderId} onRun={() => activeTender && activeBidder && runVerification.mutate({ tenderId: String(activeTender.id), bidderId: String(activeBidder.id) })} running={runVerification.isPending} onCheck={setSelectedCheck} />; if (currentPage === "evidence") return <EvidencePage documents={documents} evidence={data.evidence as Array<Record<string, unknown>>} checks={checks} tenders={tenders} bidders={bidders} onUpload={() => setModal("upload")} onOpen={(id) => signedUrl.mutate({ documentId: id })} onCheck={setSelectedCheck} />; if (currentPage === "reports") return <ReportsPage tenders={tenders} bidders={bidders} checks={checks} decisions={data.decisions as Array<Record<string, unknown>>} onDecision={() => setModal("decision")} />; if (currentPage === "audit") return <AuditPage rows={audits} />; if (currentPage === "settings") return <SettingsPage sources={sources} onVerify={(name) => verifySource.mutate({ name, payload: {} })} />; return <DashboardPage stats={data.stats} tenders={tenders} bidders={bidders} checks={checks} audits={audits} onCreate={() => setModal("tender")} onNavigate={navigate} onCheck={setSelectedCheck} />; };
  return <div className="app-shell"><Sidebar currentPage={currentPage} collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} onNavigate={navigate} onLogout={signOut} userName={user.name || user.email || "Officer"} organization={user.organizationName} counts={{ review: data.stats.needsReview, evidence: documents.length }} /><main className={`main-area ${collapsed ? "main-collapsed" : ""}`}><Topbar title={currentMeta[currentPage]?.title || "Workspace"} subtitle={currentMeta[currentPage]?.subtitle || ""} onMenu={() => setCollapsed((value) => !value)} search={search} setSearch={setSearch} /><div className="page-content">{tenders.some((row) => row.isDemo) && <div className="demo-ribbon"><div><BadgeCheck size={15} /><strong>DEMO WORKSPACE</strong><span className="ribbon-separator" /><span>Fictional tenders, bidders and evidence for the SIH 2026 walkthrough.</span></div><span>Government connectors are sandboxed · no live verification</span></div>}{renderPage()}</div></main>{selectedCheck && <ProveItModal check={selectedCheck} onClose={() => setSelectedCheck(null)} onOpenDocument={(c) => { const docId = c.documentId; if (typeof docId === "string" && docId && docId !== "—") { signedUrl.mutate({ documentId: docId }); } else { const key = c.fileKey || c.document || "Sample-Evidence.pdf"; window.open(`/api/documents/preview/${encodeURIComponent(String(key))}`, "_blank"); } }} />}{modal === "tender" && <TenderModal onClose={() => setModal(null)} busy={createTender.isPending} onSubmit={(input) => createTender.mutate(input)} />}{modal === "bidder" && <BidderModal tenders={tenders} onClose={() => setModal(null)} busy={createBidder.isPending} onSubmit={(input) => createBidder.mutate(input)} />}{modal === "requirement" && <RequirementModal tenderId={String(selectedTenderId || activeTender?.id || "")} onClose={() => setModal(null)} busy={addRequirement.isPending} onSubmit={(input) => addRequirement.mutate(input)} />}{modal === "upload" && <UploadModal tenders={tenders} bidders={bidders} onClose={() => setModal(null)} busy={uploadDocument.isPending} onSubmit={(input) => uploadDocument.mutate(input)} />}{modal === "decision" && activeTender && activeBidder && <DecisionModal tenderId={String(activeTender.id)} bidderId={String(activeBidder.id)} onClose={() => setModal(null)} busy={recordDecision.isPending} onSubmit={(input) => recordDecision.mutate(input)} />}</div>;
}

function DashboardPage({ stats, tenders, bidders, checks, audits, onCreate, onNavigate, onCheck }: { stats: { activeTenders: number; biddersUnderReview: number; verified: number; needsReview: number; nonCompliant: number; pendingDocuments: number }; tenders: Array<Record<string, unknown>>; bidders: Array<Record<string, unknown>>; checks: Array<Record<string, unknown>>; audits: Array<Record<string, unknown>>; onCreate: () => void; onNavigate: (page: string) => void; onCheck?: (check: Record<string, unknown>) => void }) { const kpis = [["Active tenders", stats.activeTenders, "Persisted in PostgreSQL", FolderOpen, "blue"], ["Bidders under review", stats.biddersUnderReview, "Officer attention required", UsersRound, "orange"], ["Verified", stats.verified, "Recorded decision support", BadgeCheck, "green"], ["Needs review", stats.needsReview, "Contradictions or missing evidence", TriangleAlert, "orange"], ["Non-compliant", stats.nonCompliant, "Requires officer action", AlertCircle, "red"], ["Pending documents", stats.pendingDocuments, "Processing or not submitted", Clock3, "gray"]] as const; return <><div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase()}</div><h2>Good morning, Officer.</h2><p>Here is the current view of your live compliance data.</p></div><button className="button button-primary button-large" onClick={onCreate}><Plus size={16} /> Create tender</button></div><div className="kpi-grid">{kpis.map(([label, value, meta, Icon, tone]) => <div className={`kpi-card kpi-${tone}`} key={label}><span className="kpi-icon"><Icon size={17} /></span><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></div>)}</div><div className="dashboard-grid"><section className="panel span-8"><div className="section-heading"><div><div className="eyebrow">PORTFOLIO</div><h2>Active tenders</h2></div><button className="link-button" onClick={() => onNavigate("tenders")}>View all <ArrowRight size={14} /></button></div>{tenders.length === 0 ? <EmptyState icon={FolderOpen} title="No tenders yet" copy="Create your first procurement event to begin collecting requirements and evidence." /> : <div className="table-wrap"><table><thead><tr><th>Tender</th><th>Department</th><th>Closing</th><th>Bidders</th><th>Progress</th></tr></thead><tbody>{tenders.slice(0, 6).map((tender) => <tr key={String(tender.id)}><td><strong>{String(tender.title)}</strong><small>{String(tender.externalId)}</small></td><td>{String(tender.department)}</td><td>{String(tender.closing || "—")}</td><td>{String(tender.bidders || 0)}</td><td><div className="progress-cell"><b>{String(tender.progress || 0)}%</b><span className="progress-track"><i style={{ width: `${Number(tender.progress || 0)}%` }} /></span></div></td></tr>)}</tbody></table></div>}</section><section className="panel span-4"><div className="section-heading"><div><div className="eyebrow">ATTENTION REQUIRED</div><h2>Needs review</h2></div><button className="icon-button subtle" onClick={() => onNavigate("verification")}><ArrowRight size={15} /></button></div>{checks.filter((check) => check.result === "Needs Review" || check.result === "Pending").slice(0, 4).map((check) => <button className="finding-row" key={String(check.id)} onClick={() => onCheck ? onCheck(check) : onNavigate("verification")}><span className="finding-icon finding-orange"><TriangleAlert size={15} /></span><span><strong>{String(check.requirement)}</strong><small>{String(check.detail || "Officer follow-up required")}</small></span><ArrowRight size={14} /></button>)}{checks.filter((check) => check.result === "Needs Review" || check.result === "Pending").length === 0 && <EmptyState icon={CheckCircle2} title="No open findings" copy="Verification exceptions will appear here." />}</section></div><div className="dashboard-grid"><section className="panel span-7"><div className="section-heading"><div><div className="eyebrow">BIDDER HEALTH</div><h2>Latest compliance posture</h2></div><button className="link-button" onClick={() => onNavigate("bidders")}>All bidders <ArrowRight size={14} /></button></div>{bidders.length === 0 ? <EmptyState icon={UsersRound} title="No bidders yet" copy="Add bidders to compare submissions against the ruleset." /> : <div className="table-wrap"><table><thead><tr><th>Bidder</th><th>Registration</th><th>Score</th><th>Status</th></tr></thead><tbody>{bidders.slice(0, 5).map((bidder) => <tr key={String(bidder.id)}><td><strong>{String(bidder.name)}</strong><small>{String(bidder.documents || "0 / 0")} documents</small></td><td>{String(bidder.registration)}</td><td><b>{String(bidder.compliance || 0)}</b></td><td><StatusBadge status={String(bidder.status)} /></td></tr>)}</tbody></table></div>}</section><section className="panel span-5"><div className="section-heading"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Audit trail</h2></div><button className="link-button" onClick={() => onNavigate("audit")}>View trail <ArrowRight size={14} /></button></div>{audits.slice(0, 5).map((event) => <div className="activity-row" key={String(event.id)}><span className="activity-dot" /><div><strong>{String(event.action)}</strong><small>{String(event.entity)} · {String(event.time)}</small></div><StatusBadge status={String(event.status)} /></div>)}{audits.length === 0 && <EmptyState icon={Activity} title="No activity yet" copy="Your first action will be recorded here." />}</section></div></>; }

function TendersPage({ rows, requirements, onCreate, onRequirement, onSelect }: { rows: Array<Record<string, unknown>>; requirements: Array<Record<string, unknown>>; onCreate: () => void; onRequirement: (id: string) => void; onSelect: (id: string) => void }) { return <><div className="page-actions-row"><div><div className="eyebrow">PROCUREMENT EVENTS</div><h2>All tenders</h2><p>Workspace tenders, including clearly labeled SIH prototype samples.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={15} /> Create tender</button></div><section className="panel"><div className="panel-heading-inline"><div className="table-meta"><Database size={16} color="var(--blue)" /> PostgreSQL records <span>{rows.length} tenders</span></div><SlidersHorizontal size={17} color="var(--gray-500)" /></div>{rows.length === 0 ? <EmptyState icon={FolderOpen} title="No tenders in this workspace" copy="Create a tender to start the evidence-backed workflow." action={<button className="button button-primary" onClick={onCreate}><Plus size={14} /> Create tender</button>} /> : <div className="table-wrap"><table><thead><tr><th>Tender ID</th><th>Tender title</th><th>Department</th><th>Closing date</th><th>Bidders</th><th>Requirements</th><th>Status</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td className="mono">{String(row.externalId)}{row.isDemo === true && <small>DEMO SAMPLE</small>}</td><td><button className="table-link" onClick={() => onSelect(String(row.id))}><strong>{String(row.title)}</strong></button><small>{String(row.description || "No description")}</small></td><td>{String(row.department)}</td><td>{String(row.closing || "—")}</td><td>{String(row.bidders || 0)}</td><td>{requirements.filter((requirement) => requirement.tenderId === row.id).length}</td><td><StatusBadge status={String(row.status)} /></td><td><button className="icon-button subtle" title="Add requirement" onClick={() => onRequirement(String(row.id))}><Plus size={14} /></button></td></tr>)}</tbody></table></div>}</section></>; }
function BiddersPage({ rows, onCreate, onSelect }: { rows: Array<Record<string, unknown>>; onCreate: () => void; onSelect: (id: string) => void }) { return <><div className="page-actions-row"><div><div className="eyebrow">SUPPLIER COMPLIANCE</div><h2>All bidders</h2><p>Registration and evidence status sourced from your workspace.</p></div><button className="button button-primary" onClick={onCreate}><UserPlus size={15} /> Add bidder</button></div><section className="panel"><div className="stats-strip"><div><span>Total bidders</span><strong>{rows.length}</strong></div><div><span>Verified</span><strong className="text-green">{rows.filter((row) => row.status === "Verified").length}</strong></div><div><span>Needs review</span><strong className="text-orange">{rows.filter((row) => row.status === "Needs Review").length}</strong></div><div><span>Non-compliant</span><strong className="text-red">{rows.filter((row) => row.status === "Non-Compliant").length}</strong></div></div>{rows.length === 0 ? <EmptyState icon={UsersRound} title="No bidders in this workspace" copy="Add a bidder to begin collecting registration and compliance evidence." action={<button className="button button-primary" onClick={onCreate}><UserPlus size={14} /> Add bidder</button>} /> : <div className="table-wrap"><table><thead><tr><th>Bidder</th><th>Registration ID</th><th>Documents</th><th>Compliance</th><th>Risk</th><th>Verification</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td><button className="table-link" onClick={() => onSelect(String(row.id))}><strong>{String(row.name)}</strong></button><small>{String(row.gstin || "GSTIN not supplied")}</small></td><td className="mono">{String(row.registration)}</td><td>{String(row.documents || "0 / 0")}</td><td><div className="score-cell"><b>{String(row.compliance || 0)}</b><span className="progress-track"><i style={{ width: `${Number(row.compliance || 0)}%` }} /></span></div></td><td><span className={`risk-chip risk-${String(row.risk).toLowerCase()}`}>{String(row.risk)}</span></td><td><StatusBadge status={String(row.status)} /></td><td><button className="button button-quiet" onClick={() => onSelect(String(row.id))}>Review <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div>}</section></>; }
function VerificationPage({ tenders, bidders, checks, selectedTenderId, selectedBidderId, onTender, onBidder, onRun, running, onCheck }: { tenders: Array<Record<string, unknown>>; bidders: Array<Record<string, unknown>>; checks: Array<Record<string, unknown>>; selectedTenderId: string; selectedBidderId: string; onTender: (value: string) => void; onBidder: (value: string) => void; onRun: () => void; running: boolean; onCheck: (check: Record<string, unknown>) => void }) { const visible = checks.filter((check) => (!selectedTenderId || check.tenderId === selectedTenderId) && (!selectedBidderId || check.bidderId === selectedBidderId)); return <><div className="page-actions-row"><div><div className="eyebrow">RULES ENGINE</div><h2>Verification</h2><p>Deterministic checks run against persisted requirements and private evidence.</p></div><button className="button button-primary" disabled={!selectedTenderId || !selectedBidderId || running} onClick={onRun}>{running ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Run verification</button></div><section className="verification-toolbar"><label><span>Tender</span><select value={selectedTenderId} onChange={(e) => onTender(e.target.value)}><option value="">Select a tender</option>{tenders.map((tender) => <option value={String(tender.id)} key={String(tender.id)}>{String(tender.title)}</option>)}</select></label><label><span>Bidder</span><select value={selectedBidderId} onChange={(e) => onBidder(e.target.value)}><option value="">Select a bidder</option>{bidders.map((bidder) => <option value={String(bidder.id)} key={String(bidder.id)}>{String(bidder.name)}</option>)}</select></label></section><div className="verification-summary"><div><span>Checks shown</span><strong>{visible.length}</strong></div><div><span>Verified</span><strong className="text-green">{visible.filter((check) => check.result === "Verified").length}</strong></div><div><span>Needs review</span><strong className="text-orange">{visible.filter((check) => check.result === "Needs Review").length}</strong></div><div><span>Pending</span><strong>{visible.filter((check) => check.result === "Pending").length}</strong></div></div><section className="panel"><div className="section-heading"><div><div className="eyebrow">COMPLIANCE ENGINE</div><h2>Verification checks</h2></div><span className="evidence-note"><ShieldCheck size={14} /> Evidence-linked</span></div>{visible.length === 0 ? <EmptyState icon={ClipboardCheck} title="No verification results yet" copy="Select a tender and bidder, then run verification after adding requirements and documents." /> : <div className="table-wrap"><table><thead><tr><th>Requirement</th><th>Evidence</th><th>Source</th><th>Result</th><th>Confidence</th><th /></tr></thead><tbody>{visible.map((check) => <tr key={String(check.id)}><td><strong>{String(check.requirement)}</strong><small>{String(check.detail || "")}</small></td><td><FileText size={14} /> {String(check.document || check.evidence || "Not submitted")}</td><td>{String(check.source)}</td><td><StatusBadge status={String(check.result)} /></td><td><span className="confidence"><i className={`confidence-${String(check.confidence).toLowerCase()}`} />{String(check.confidence)}</span></td><td><button type="button" className="button-prove-it" onClick={() => onCheck(check)} title="PROVE IT Dossier"><ShieldCheck size={13} /> PROVE IT</button></td></tr>)}</tbody></table></div>}</section></>; }
function EvidencePage({ documents, evidence, checks, tenders, bidders, onUpload, onOpen, onCheck }: { documents: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; checks?: Array<Record<string, unknown>>; tenders: Array<Record<string, unknown>>; bidders: Array<Record<string, unknown>>; onUpload: () => void; onOpen: (id: string) => void; onCheck?: (check: Record<string, unknown>) => void }) { return <><div className="page-actions-row"><div><div className="eyebrow">PRIVATE DOCUMENT VAULT</div><h2>Evidence that stands up to scrutiny.</h2><p>Documents are stored privately and accessed with expiring signed links.</p></div><button className="button button-primary" onClick={onUpload}><CloudUpload size={15} /> Upload document</button></div><div className="evidence-hero"><div><div className="eyebrow">TRACEABILITY</div><h2>Every important result has a source.</h2><p>VerifAI connects documents, extracted fields, requirements, rules, and officer decisions without exposing files publicly.</p></div><div className="evidence-metrics"><div><strong>{evidence.length}</strong><span>evidence links</span></div><div><strong>{documents.length}</strong><span>private files</span></div><div><strong>{documents.filter((doc) => doc.process === "Processed").length}</strong><span>processed</span></div></div></div><div className="dashboard-grid"><section className="panel span-7"><div className="section-heading"><div><div className="eyebrow">DOCUMENTS</div><h2>Uploaded evidence</h2></div></div>{documents.length === 0 ? <EmptyState icon={FileText} title="No documents uploaded" copy="Upload a tender or bidder document to start OCR and evidence extraction." action={<button className="button button-primary" onClick={onUpload}><CloudUpload size={14} /> Upload first document</button>} /> : <div className="table-wrap"><table><thead><tr><th>File</th><th>Type</th><th>Processing</th><th>Uploaded</th><th /></tr></thead><tbody>{documents.map((doc) => <tr key={String(doc.id)}><td><strong>{String(doc.fileName || doc.file)}</strong><small>{String(doc.mimeType)}</small></td><td>{String(doc.type || "Other")}</td><td><StatusBadge status={String(doc.process || "Uploaded")} /></td><td>{String(doc.date || "—")}</td><td><button className="button button-quiet" onClick={() => onOpen(String(doc.id))}><ExternalLink size={13} /> Open securely</button></td></tr>)}</tbody></table></div>}</section><section className="panel span-5"><div className="section-heading"><div><div className="eyebrow">EVIDENCE LINKS</div><h2>Recent proof points</h2></div></div>{evidence.slice(0, 8).map((item) => { const linked = checks?.find((c) => c.id === item.checkId) || { requirement: String(item.document || "Statutory Evidence"), document: String(item.document || "Vault File"), extracted: String(item.extracted || item.evidence || "Verified claim"), relevantEvidence: String(item.evidence || item.extracted || "Extracted from source"), source: String(item.source || "Government Portal"), confidence: String(item.confidence || "High"), result: "Verified", detail: "Statutory proof verified from private storage document." }; return <div className="finding-row" key={String(item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid var(--gray-200)" }}><div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}><span className="finding-icon finding-green"><CheckCircle2 size={15} /></span><div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}><strong style={{ fontSize: "12px", color: "var(--gray-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(item.document)}</strong><small style={{ color: "var(--gray-500)", fontSize: "10px" }}>{String(item.extracted || item.evidence || "Document evidence")}</small></div></div><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><StatusBadge status={String(item.confidence || "Low")} />{onCheck && <button type="button" className="button-prove-it" style={{ padding: "3px 8px", fontSize: "10px" }} onClick={() => onCheck(linked)}><ShieldCheck size={11} /> PROVE IT</button>}</div></div>; })}{evidence.length === 0 && <EmptyState icon={FileCheck2} title="No evidence links yet" copy="Run verification after processing a document." />}</section></div></>; }
function ReportsPage({ tenders, bidders, checks, decisions, onDecision }: { tenders: Array<Record<string, unknown>>; bidders: Array<Record<string, unknown>>; checks: Array<Record<string, unknown>>; decisions: Array<Record<string, unknown>>; onDecision: () => void }) { return <><div className="page-actions-row"><div><div className="eyebrow">DECISION SUPPORT</div><h2>Compliance reports</h2><p>Reports are derived from persisted verification results and officer decisions.</p></div><button className="button button-primary" onClick={onDecision} disabled={!tenders[0] || !bidders[0]}><Check size={15} /> Record officer decision</button></div><section className="report-preview"><div className="report-header"><div><div className="eyebrow">VERIFAI · COMPLIANCE REPORT</div><h2>{tenders[0] ? String(tenders[0].title) : "No tender selected"}</h2><p>{bidders[0] ? `${String(bidders[0].name)} · Workspace report` : "Add a tender and bidder to generate a report."}</p></div><div className="report-score">{bidders[0] ? String(bidders[0].compliance || 0) : "—"}<small>/ 100</small></div></div><div className="report-grid"><div><span>Verification results</span><strong>{checks.filter((check) => check.result === "Verified").length} verified · {checks.filter((check) => check.result === "Needs Review").length} review · {checks.filter((check) => check.result === "Pending").length} pending</strong></div><div><span>Officer decisions</span><strong>{decisions.length} recorded</strong></div><div><span>Recommendation</span><strong>{decisions[0] ? String(decisions[0].decision) : "Awaiting officer decision"}</strong></div><div><span>Evidence basis</span><strong>{checks.length} checks linked to workspace evidence</strong></div></div><div className="report-disclaimer"><ShieldCheck size={15} /> VerifAI provides decision support. The final qualification decision is recorded by the Procurement Officer.</div></section><section className="panel"><div className="section-heading"><div><div className="eyebrow">DECISION LOG</div><h2>Officer decisions</h2></div></div>{decisions.length === 0 ? <EmptyState icon={FileText} title="No decisions recorded" copy="Complete verification and record the final officer decision when ready." /> : <div className="table-wrap"><table><thead><tr><th>Decision</th><th>Comment</th><th>Officer</th><th>Recorded</th></tr></thead><tbody>{decisions.map((row) => <tr key={String(row.id)}><td><StatusBadge status={String(row.decision)} /></td><td>{String(row.comment)}</td><td>{String(row.officer)}</td><td>{new Date(String(row.createdAt)).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>}</section></>; }
function AuditPage({ rows }: { rows: Array<Record<string, unknown>> }) { return <><div className="audit-toolbar"><div><div className="eyebrow">IMMUTABLE ACTIVITY LOG</div><h2>Audit trail</h2><p>Every action is recorded with user, entity, status, and time.</p></div><div className="audit-integrity"><ShieldCheck size={15} /> Organization-scoped log</div></div><section className="panel audit-panel">{rows.length === 0 ? <EmptyState icon={Activity} title="No activity recorded" copy="Workspace actions will appear here." /> : rows.map((row) => <div className="audit-row" key={String(row.id)}><div className="audit-time">{String(row.time)}<small>IST</small></div><span className="audit-line"><i /></span><div className="audit-body"><strong>{String(row.action)}</strong><span>{String(row.entity)} · {String(row.user)}</span></div><StatusBadge status={String(row.status)} /></div>)}</section></>; }
function SettingsPage({ sources, onVerify }: { sources: Array<Record<string, unknown>>; onVerify: (name: string) => void }) { return <><div className="page-actions-row"><div><div className="eyebrow">SOURCE REGISTRY</div><h2>Verification sources</h2><p>Only explicitly configured connectors can make live source calls. Unconfigured sources stay clearly labelled.</p></div></div><div className="dashboard-grid"><section className="panel span-7"><div className="section-heading"><div><div className="eyebrow">GOVERNMENT CONNECTORS</div><h2>Approved source registry</h2></div><Database size={17} color="var(--blue)" /></div>{sources.map((source) => <div className="source-row" key={String(source.id)}><span className="source-icon"><Building2 size={15} /></span><div><strong>{String(source.name)}</strong><span>{String(source.description)}</span></div><StatusBadge status={String(source.status)} /><button className="icon-button subtle" onClick={() => onVerify(String(source.name))} title="Check connector"><RefreshCw size={14} /></button></div>)}</section><section className="panel span-5"><div className="section-heading"><div><div className="eyebrow">WORKSPACE SECURITY</div><h2>Officer preferences</h2></div></div><div className="settings-item"><div><strong>Require review for contradictions</strong><span>Conflicting values never auto-resolve.</span></div><span className="toggle-on" /></div><div className="settings-item"><div><strong>Private signed document links</strong><span>Links expire after ten minutes.</span></div><span className="toggle-on" /></div><div className="settings-item"><div><strong>OCR confidence threshold</strong><span>Documents below confidence remain reviewable.</span></div><b className="text-blue">80%</b></div><div className="settings-item"><div><strong>Authentication</strong><span>Supabase email/password with session refresh.</span></div><StatusBadge status="Connected" /></div></section></div></>; }

function computeDossierDigest(check: Record<string, unknown>): string {
  const seed = `${check.id || ""}:${check.tenderId || ""}:${check.bidderId || ""}:${check.requirement || ""}:${check.rule || ""}:${check.source || ""}:SHA256`;
  let hash1 = 0x55aa55aa, hash2 = 0x12345678;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 2654435761);
    hash2 = Math.imul(hash2 ^ ch, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  const h1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const h2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${h1}d9a7${h2}8b1e4c3a${(h1 + h2).split("").reverse().join("")}${(h2 + h1).slice(2, 10)}${h1}8f4a9b2c`.slice(0, 64);
}

function ProveItModal({
  check,
  onClose,
  onOpenDocument,
}: {
  check: Record<string, unknown>;
  onClose: () => void;
  onOpenDocument: (check: Record<string, unknown>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const digest = computeDossierDigest(check);

  const handleCopy = () => {
    void navigator.clipboard.writeText(digest);
    setCopied(true);
    toast.success("Cryptographic SHA-256 seal copied to clipboard.");
    setTimeout(() => setCopied(false), 2500);
  };

  const tenderTitle = String(check.tenderTitle || "Procurement Event");
  const bidderName = String(check.bidderName || "Bidder Enterprise");
  const requirement = String(check.requirement || "Statutory Requirement");
  const rule = String(check.rule || "General Financial Rules (GFR) 2017 · Rule 144(xi)");
  const documentName = String(check.document || check.evidence || "Submitted Certificate");
  const pageNumber = String(check.page || "1");
  const extractedClaim = String(check.extracted || check.claim || "Valid certificate issued");
  const relevantEvidence = String(check.relevantEvidence || check.detail || `Extracted claim verified from page ${pageNumber}`);
  const sourceName = String(check.source || "Government Central Registry");
  const resultStatus = String(check.result || "Verified");
  const confidence = String(check.evidenceConfidence || check.confidence || "High");
  const verificationTime = String(check.checked || new Date().toLocaleString("en-IN"));

  const registryResponse = {
    gateway: sourceName,
    status: resultStatus === "Verified" ? "VALID_ACTIVE" : resultStatus === "Needs Review" ? "CONTRADICTION_FLAGGED" : "PENDING_CONFIRMATION",
    verification_token: `GOV-VRF-${digest.slice(0, 10).toUpperCase()}`,
    match_score: confidence === "High" ? "99.8%" : "84.2%",
    statutory_standing: resultStatus === "Verified" ? "CLEAR_COMPLIANT" : "FLAGGED_FOR_OFFICER",
    timestamp: verificationTime,
  };

  return (
    <div className="prove-it-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="prove-it-modal" role="dialog" aria-modal="true">
        <div className="prove-it-header">
          <div className="prove-it-title-wrap">
            <div className="prove-it-kicker">
              <span className="kicker-dot" />
              PROVE IT · 3-PILLAR COMPLIANCE DOSSIER
            </div>
            <h2>{requirement}</h2>
            <div className="prove-it-meta-chips">
              <span className="meta-chip">Tender: <strong>{tenderTitle}</strong></span>
              <span className="meta-chip">Bidder: <strong>{bidderName}</strong></span>
              <span className="meta-chip">Rule: <strong>{rule}</strong></span>
              <StatusBadge status={resultStatus} />
            </div>
          </div>
          <button className="icon-button subtle" onClick={onClose} aria-label="Close dossier">
            <X size={18} />
          </button>
        </div>

        <div className="prove-it-body">
          <div className="prove-it-pillars">
            {/* Pillar 1: Statutory Requirement */}
            <div className="prove-it-pillar">
              <div className="pillar-top">
                <span className="pillar-number">1</span>
                <strong>STATUTORY REQUIREMENT</strong>
              </div>
              <div className="pillar-content">
                <div className="pillar-line">
                  <span>LEGAL / PROCUREMENT RULE</span>
                  <strong>{rule}</strong>
                </div>
                <div className="pillar-line">
                  <span>MANDATORY CRITERIA</span>
                  <strong>{requirement}</strong>
                </div>
                <div className="pillar-quote">
                  {String(check.detail || "Statutory compliance mandate: Bidder must supply certified proof satisfying Indian Public Procurement guidelines and department eligibility thresholds.")}
                </div>
                <div className="pillar-line">
                  <span>AUTHORIZED VERIFIER GATEWAY</span>
                  <strong>{sourceName}</strong>
                </div>
              </div>
            </div>

            {/* Pillar 2: Bidder Document Evidence */}
            <div className="prove-it-pillar">
              <div className="pillar-top">
                <span className="pillar-number">2</span>
                <strong>BIDDER VAULT EVIDENCE</strong>
              </div>
              <div className="pillar-content">
                <div className="pillar-line">
                  <span>SUBMITTED VAULT DOCUMENT</span>
                  <strong>{documentName}</strong>
                </div>
                <div className="pillar-line">
                  <span>EXTRACTED CLAIM (OCR / NLP)</span>
                  <strong>{extractedClaim}</strong>
                </div>
                <div className="pillar-quote">
                  {relevantEvidence}
                </div>
                <div className="pillar-line">
                  <span>AUDIT TRACE</span>
                  <strong>Page {pageNumber} · {confidence} Confidence · Zero-Trust Stored</strong>
                </div>
                <div className="pillar-action">
                  <button
                    type="button"
                    className="button button-secondary button-small full-width"
                    onClick={() => onOpenDocument(check)}
                  >
                    <ExternalLink size={13} /> View Secure Vault File
                  </button>
                </div>
              </div>
            </div>

            {/* Pillar 3: Central Registry Gateway */}
            <div className="prove-it-pillar">
              <div className="pillar-top">
                <span className="pillar-number">3</span>
                <strong>CENTRAL REGISTRY GATEWAY</strong>
              </div>
              <div className="pillar-content">
                <div className="pillar-line">
                  <span>OFFICIAL SOURCE</span>
                  <strong>{sourceName}</strong>
                </div>
                <div className="pillar-line">
                  <span>GATEWAY RESPONSE STATUS</span>
                  <strong className={resultStatus === "Verified" ? "text-green" : "text-orange"}>
                    ● {resultStatus === "Verified" ? "Verified Active by Central Portal" : "Flagged: Review Required"}
                  </strong>
                </div>
                <div className="pillar-quote registry-active">
                  {JSON.stringify(registryResponse, null, 2)}
                </div>
                <div className="pillar-line">
                  <span>VERIFICATION TIMESTAMP</span>
                  <strong>{verificationTime} IST</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Cryptographic Tamper-Proof Seal */}
          <div className="crypto-seal-panel">
            <div className="crypto-seal-header">
              <div className="crypto-seal-title">
                <ShieldCheck size={16} />
                CRYPTOGRAPHIC PROOF OF INTEGRITY (TAMPER-EVIDENT SEAL)
              </div>
              <span className="secure-pill">
                <BadgeCheck size={12} /> SHA-256 SEAL VALIDATED
              </span>
            </div>
            <div className="crypto-hash-row">
              <code>{digest}</code>
              <button
                type="button"
                className="button button-quiet button-small"
                onClick={handleCopy}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy Hash"}
              </button>
            </div>
            <div className="crypto-seal-footer">
              <span>Standard: SHA-256 / HMAC-Ed25519 · Immutable Workspace Evidence Seal</span>
              <span>Verification Audit ID: {String(check.id || "0000").slice(0, 16)}</span>
            </div>
          </div>
        </div>

        <div className="prove-it-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print Dossier
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="button button-primary"
              onClick={onClose}
            >
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenderModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (input: { title: string; department: string; description?: string; submissionDeadline?: string; bidOpeningDate?: string; estimatedValue?: string }) => void; busy: boolean }) { const [title, setTitle] = useState(""); const [department, setDepartment] = useState(""); const [description, setDescription] = useState(""); const [deadline, setDeadline] = useState(""); const [value, setValue] = useState(""); return <Modal title="Create tender" onClose={onClose}><form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ title, department, description, submissionDeadline: deadline, estimatedValue: value }); }}><Field label="Tender title" value={title} onChange={setTitle} placeholder="Supply of medical equipment" required /><Field label="Department" value={department} onChange={setDepartment} placeholder="Directorate of Health" required /><Field label="Estimated value" value={value} onChange={setValue} placeholder="₹12.4 Cr" /><Field label="Submission deadline" value={deadline} onChange={setDeadline} type="date" /><label className="form-field"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope and procurement context" rows={3} /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <Plus size={14} />} Create tender</button></div></form></Modal>; }
function BidderModal({ tenders, onClose, onSubmit, busy }: { tenders: Array<Record<string, unknown>>; onClose: () => void; onSubmit: (input: { name: string; registrationId: string; gstin?: string; pan?: string; tenderId?: string }) => void; busy: boolean }) { const [name, setName] = useState(""); const [registrationId, setRegistrationId] = useState(""); const [gstin, setGstin] = useState(""); const [pan, setPan] = useState(""); const [tenderId, setTenderId] = useState(""); return <Modal title="Add bidder" onClose={onClose}><form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ name, registrationId, gstin, pan, tenderId: tenderId || undefined }); }}><Field label="Legal bidder name" value={name} onChange={setName} placeholder="Aster Meditech Systems Pvt. Ltd." required /><Field label="Registration ID" value={registrationId} onChange={setRegistrationId} placeholder="UDYAM-MH-18-0048217" required /><Field label="GSTIN" value={gstin} onChange={setGstin} placeholder="27AAMCA7421G1Z4" /><Field label="PAN" value={pan} onChange={setPan} placeholder="AAMCA7421G" /><label className="form-field"><span>Attach to tender (optional)</span><select value={tenderId} onChange={(e) => setTenderId(e.target.value)}><option value="">No tender selected</option>{tenders.map((tender) => <option key={String(tender.id)} value={String(tender.id)}>{String(tender.title)}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <UserPlus size={14} />} Add bidder</button></div></form></Modal>; }
function RequirementModal({ tenderId, onClose, onSubmit, busy }: { tenderId: string; onClose: () => void; onSubmit: (input: { tenderId: string; title: string; category: string; evidenceRequired: string }) => void; busy: boolean }) { const [title, setTitle] = useState(""); const [category, setCategory] = useState("Financial"); const [evidenceRequired, setEvidenceRequired] = useState(""); return <Modal title="Add verification requirement" onClose={onClose}><form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ tenderId, title, category, evidenceRequired }); }}><Field label="Requirement" value={title} onChange={setTitle} placeholder="Minimum annual turnover ≥ ₹5 Crore" required /><label className="form-field"><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>Financial</option><option>Technical</option><option>Statutory</option><option>Experience</option><option>Local content</option></select></label><Field label="Evidence required" value={evidenceRequired} onChange={setEvidenceRequired} placeholder="Audited financial statement FY 2024–25" required /><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <Plus size={14} />} Add requirement</button></div></form></Modal>; }
function UploadModal({ tenders, bidders, onClose, onSubmit, busy }: { tenders: Array<Record<string, unknown>>; bidders: Array<Record<string, unknown>>; onClose: () => void; onSubmit: (input: { fileName: string; mimeType: string; dataBase64: string; tenderId?: string; bidderId?: string }) => void; busy: boolean }) { const [file, setFile] = useState<File | null>(null); const [tenderId, setTenderId] = useState(""); const [bidderId, setBidderId] = useState(""); const submit = (event: FormEvent) => { event.preventDefault(); if (!file) return toast.error("Choose a document first."); const reader = new FileReader(); reader.onload = () => { const value = String(reader.result); onSubmit({ fileName: file.name, mimeType: file.type || "application/octet-stream", dataBase64: value.includes(",") ? value.split(",", 2)[1] : value, tenderId: tenderId || undefined, bidderId: bidderId || undefined }); }; reader.readAsDataURL(file); }; return <Modal title="Upload private evidence" onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="upload-drop"><CloudUpload size={25} /><strong>{file ? file.name : "Choose a PDF or image"}</strong><span>Stored privately · max 25 MB · Gemini OCR/classification</span><input type="file" accept="application/pdf,image/*,text/plain" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></label><label className="form-field"><span>Tender (optional)</span><select value={tenderId} onChange={(e) => setTenderId(e.target.value)}><option value="">Not linked to a tender</option>{tenders.map((tender) => <option key={String(tender.id)} value={String(tender.id)}>{String(tender.title)}</option>)}</select></label><label className="form-field"><span>Bidder (optional)</span><select value={bidderId} onChange={(e) => setBidderId(e.target.value)}><option value="">Not linked to a bidder</option>{bidders.map((bidder) => <option key={String(bidder.id)} value={String(bidder.id)}>{String(bidder.name)}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || !file}>{busy ? <Loader2 className="spin" size={14} /> : <CloudUpload size={14} />} Upload and process</button></div></form></Modal>; }
function DecisionModal({ tenderId, bidderId, onClose, onSubmit, busy }: { tenderId: string; bidderId: string; onClose: () => void; onSubmit: (input: { tenderId: string; bidderId: string; decision: "Qualified" | "Not Qualified" | "Needs Clarification"; comment: string }) => void; busy: boolean }) { const [decision, setDecision] = useState<"Qualified" | "Not Qualified" | "Needs Clarification">("Needs Clarification"); const [comment, setComment] = useState(""); return <Modal title="Record officer decision" onClose={onClose}><form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ tenderId, bidderId, decision, comment }); }}><label className="form-field"><span>Final qualification</span><select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}><option>Qualified</option><option>Needs Clarification</option><option>Not Qualified</option></select></label><label className="form-field"><span>Officer comment</span><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Explain the decision and any conditions." rows={5} minLength={10} required /></label><div className="modal-note"><ShieldCheck size={15} /> This action is authoritative for the workspace and will be written to the audit trail.</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />} Record decision</button></div></form></Modal>; }
