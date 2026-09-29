import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const updatePassword = trpc.auth.updatePassword.useMutation({ onSuccess: () => { toast.success("Password updated. You can now sign in."); setSubmitted(true); }, onError: (error) => toast.error(error.message) });
  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.hash.replace(/^#/, ""));
  }, []);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  useEffect(() => {
    if (!accessToken || type === "recovery") return;
    localStorage.setItem("verifai-session", JSON.stringify({ access_token: accessToken, refresh_token: refreshToken || "", expires_in: Number(params.get("expires_in") || 3600), expires_at: Number(params.get("expires_at") || 0) }));
    setLocation("/app/dashboard");
  }, [accessToken, refreshToken, type, params, setLocation]);

  if (submitted) return <div className="loading-screen"><div className="auth-callback-card"><CheckCircle2 color="var(--green)" size={30} /><h2>Password updated</h2><p>Your account is ready. Sign in with your new password.</p><button className="button button-primary" onClick={() => setLocation("/")}>Return to sign in</button></div></div>;
  if (!accessToken) return <div className="loading-screen"><div className="auth-callback-card"><TriangleAlert color="var(--orange)" size={30} /><h2>Link unavailable</h2><p>This authentication link is missing or expired. Request a new password reset link.</p><button className="button button-primary" onClick={() => setLocation("/")}>Return to sign in</button></div></div>;
  if (type !== "recovery") return <div className="loading-screen"><Loader2 className="spin" size={18} /> Completing secure sign-in…</div>;
  return <div className="loading-screen"><div className="auth-callback-card"><div className="callback-brand"><span className="brand-mark"><ShieldCheck size={18} /></span><strong>Verif<span>AI</span></strong></div><KeyRound color="var(--blue)" size={27} /><h2>Set a new password</h2><p>Choose a new password for your secure procurement workspace.</p><form className="auth-form" onSubmit={(event) => { event.preventDefault(); updatePassword.mutate({ accessToken, password }); }}><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="At least 8 characters" required /></label><button className="button button-primary button-large full-width" disabled={updatePassword.isPending}>{updatePassword.isPending ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />} Update password</button></form></div></div>;
}
