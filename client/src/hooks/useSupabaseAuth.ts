import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const SESSION_KEY = "verifai-session";

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id: string; email?: string; user_metadata?: Record<string, unknown> };
};

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Authentication still works for the current page when storage is blocked.
  }
}

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { enabled: Boolean(session?.access_token), retry: false, staleTime: 60_000 });
  const signInMutation = trpc.auth.signIn.useMutation();
  const demoSignInMutation = trpc.auth.demoSignIn.useMutation();
  const signUpMutation = trpc.auth.signUp.useMutation();
  const resetMutation = trpc.auth.requestReset.useMutation();
  const refreshMutation = trpc.auth.refresh.useMutation();

  const clear = useCallback(() => {
    saveSession(null);
    setSession(null);
    utils.auth.me.setData(undefined, null);
  }, [utils]);

  useEffect(() => {
    if (!session?.refresh_token || !meQuery.isError) return;
    refreshMutation.mutate({ refreshToken: session.refresh_token }, {
      onSuccess: (data) => {
        saveSession(data.session as Session);
        setSession(data.session as Session);
        void utils.auth.me.invalidate();
      },
      onError: () => clear(),
    });
  }, [session, meQuery.isError, refreshMutation, clear, utils]);

  const demoSignIn = useCallback((role: "officer" | "admin") => {
    demoSignInMutation.mutate({ role }, {
      onSuccess: (data) => {
        saveSession(data.session as Session);
        setSession(data.session as Session);
        void utils.auth.me.invalidate();
        toast.success(`Signed in as ${role === "admin" ? "Chief Procurement Auditor (Admin)" : "Procurement Officer"}.`);
      },
      onError: (error) => toast.error(error.message),
    });
  }, [demoSignInMutation, utils]);

  const signIn = useCallback((email: string, password: string) => {
    signInMutation.mutate({ email, password }, {
      onSuccess: (data) => {
        saveSession(data.session as Session);
        setSession(data.session as Session);
        void utils.auth.me.invalidate();
        toast.success("Signed in securely.");
      },
      onError: (error) => toast.error(error.message),
    });
  }, [signInMutation, utils]);

  const signUp = useCallback((email: string, password: string, fullName: string, organization: string) => {
    signUpMutation.mutate({ email, password, fullName, organization }, {
      onSuccess: (data) => {
        if (data.session) {
          saveSession(data.session as Session);
          setSession(data.session as Session);
          void utils.auth.me.invalidate();
          toast.success("Account created securely.");
        } else {
          toast.success("Account created. Check your email to confirm access, then sign in.");
        }
      },
      onError: (error) => toast.error(error.message),
    });
  }, [signUpMutation, utils]);

  const requestReset = useCallback((email: string) => {
    resetMutation.mutate({ email }, {
      onSuccess: () => toast.success("Password reset instructions sent if the account exists."),
      onError: (error) => toast.error(error.message),
    });
  }, [resetMutation]);

  const signOut = useCallback(() => {
    clear();
    toast.success("Signed out.");
  }, [clear]);

  return {
    user: meQuery.data,
    loading: Boolean(session?.access_token) && (meQuery.isLoading || refreshMutation.isPending),
    isAuthenticated: Boolean(session?.access_token && meQuery.data),
    signIn,
    demoSignIn,
    signUp,
    requestReset,
    signOut,
    busy: signInMutation.isPending || demoSignInMutation.isPending || signUpMutation.isPending || resetMutation.isPending,
  };
}
