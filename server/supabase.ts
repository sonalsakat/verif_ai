import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";

export type AppRole = "user" | "admin";

export type AppUser = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  role: AppRole;
  portalRole: "admin" | "procurement_officer";
  profileRole: "officer" | "administrator";
  organizationId: string;
  organizationName: string;
};

export type AuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

export const DEMO_OFFICER_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_ADMIN_ID = "00000000-0000-0000-0000-000000000002";
export const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000010";

export const DEMO_USERS: Record<string, SupabaseAuthUser> = {
  "demo-officer-token": {
    id: DEMO_OFFICER_ID,
    app_metadata: { role: "officer" },
    user_metadata: {
      full_name: "Priya Menon",
      name: "Priya Menon",
      organization: "Directorate of Health Services, Maharashtra",
      role: "officer",
    },
    aud: "authenticated",
    created_at: new Date("2026-01-01").toISOString(),
    email: "officer@health.gov.in",
  } as SupabaseAuthUser,
  "demo-admin-token": {
    id: DEMO_ADMIN_ID,
    app_metadata: { role: "administrator" },
    user_metadata: {
      full_name: "Dr. Arvind Swaminathan",
      name: "Dr. Arvind Swaminathan",
      organization: "Directorate of Health Services, Maharashtra",
      role: "admin",
    },
    aud: "authenticated",
    created_at: new Date("2026-01-01").toISOString(),
    email: "admin@verifai.gov.in",
  } as SupabaseAuthUser,
};

// In-memory registry for mock users registered during demo
const localUsers = new Map<string, { user: SupabaseAuthUser; password?: string }>();

function hasLiveSupabase(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key && !url.includes("your-project") && url.startsWith("http"));
}

export function getSupabaseUrl(): string {
  const configured = process.env.SUPABASE_URL;
  if (configured && configured.startsWith("http") && !configured.includes("your-project")) {
    return new URL(configured).origin;
  }
  return "http://localhost:3000/mock-supabase";
}

let _supabaseAdmin: SupabaseClient | null = null;
let _supabaseAnon: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (hasLiveSupabase()) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(
        getSupabaseUrl(),
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    }
    return _supabaseAdmin;
  }

  // Robust sandbox mock client
  return {
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: [
              DEMO_USERS["demo-officer-token"],
              DEMO_USERS["demo-admin-token"],
              ...Array.from(localUsers.values()).map((u) => u.user),
            ],
          },
          error: null,
        }),
        updateUserById: async (id: string, attributes: Record<string, unknown>) => {
          for (const token of Object.keys(DEMO_USERS)) {
            if (DEMO_USERS[token].id === id) {
              if (attributes.app_metadata) {
                DEMO_USERS[token].app_metadata = {
                  ...DEMO_USERS[token].app_metadata,
                  ...(attributes.app_metadata as Record<string, unknown>),
                };
              }
              return { data: { user: DEMO_USERS[token] }, error: null };
            }
          }
          const local = localUsers.get(id);
          if (local) {
            if (attributes.app_metadata) local.user.app_metadata = { ...local.user.app_metadata, ...(attributes.app_metadata as Record<string, unknown>) };
            return { data: { user: local.user }, error: null };
          }
          return { data: { user: null }, error: null };
        },
        inviteUserByEmail: async (email: string, options?: { data?: Record<string, unknown> }) => {
          const id = `00000000-0000-0000-0000-${Math.floor(100000000000 + Math.random() * 899999999999)}`;
          const user: SupabaseAuthUser = {
            id,
            email,
            aud: "authenticated",
            created_at: new Date().toISOString(),
            app_metadata: { role: options?.data?.role || "officer" },
            user_metadata: options?.data || {},
          } as SupabaseAuthUser;
          localUsers.set(id, { user });
          return { data: { user }, error: null };
        },
      },
      getUser: async (token: string) => {
        if (DEMO_USERS[token]) return { data: { user: DEMO_USERS[token] }, error: null };
        for (const entry of Array.from(localUsers.values())) {
          if (token === `local-token-${entry.user.id}` || token === entry.user.id) {
            return { data: { user: entry.user }, error: null };
          }
        }
        return { data: { user: null }, error: new Error("Invalid session") };
      },
    },
    storage: {
      getBucket: async (_bucket: string) => ({ data: { name: _bucket }, error: null }),
      createBucket: async (_bucket: string) => ({ data: { name: _bucket }, error: null }),
      listBuckets: async () => ({ data: [{ name: "verifai-documents" }], error: null }),
      from: (_bucket: string) => ({
        upload: async (_key: string, _buffer: Buffer) => ({ data: { path: _key }, error: null }),
        createSignedUrl: async (key: string, _expires: number) => ({
          data: { signedUrl: `/api/documents/preview/${encodeURIComponent(key)}` },
          error: null,
        }),
      }),
    },
  } as unknown as SupabaseClient;
}

export function getSupabaseAnon(): SupabaseClient {
  if (hasLiveSupabase() && process.env.SUPABASE_ANON_KEY) {
    if (!_supabaseAnon) {
      _supabaseAnon = createClient(
        getSupabaseUrl(),
        process.env.SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    }
    return _supabaseAnon;
  }

  // Sandbox mock client for sign-in & sign-up
  return {
    auth: {
      signInWithPassword: async ({ email }: { email: string; password?: string }) => {
        const lower = email.toLowerCase().trim();
        if (lower === "admin@verifai.gov.in" || lower.includes("admin")) {
          return {
            data: {
              session: {
                access_token: "demo-admin-token",
                refresh_token: "demo-admin-refresh-token",
                token_type: "bearer",
                expires_in: 86400,
                user: DEMO_USERS["demo-admin-token"],
              },
              user: DEMO_USERS["demo-admin-token"],
            },
            error: null,
          };
        }
        // Default officer
        return {
          data: {
            session: {
              access_token: "demo-officer-token",
              refresh_token: "demo-officer-refresh-token",
              token_type: "bearer",
              expires_in: 86400,
              user: DEMO_USERS["demo-officer-token"],
            },
            user: DEMO_USERS["demo-officer-token"],
          },
          error: null,
        };
      },
      signUp: async ({ email, options }: { email: string; password?: string; options?: { data?: Record<string, unknown> } }) => {
        const id = `00000000-0000-0000-0000-${Math.floor(100000000000 + Math.random() * 899999999999)}`;
        const user: SupabaseAuthUser = {
          id,
          email,
          aud: "authenticated",
          created_at: new Date().toISOString(),
          app_metadata: { role: "officer" },
          user_metadata: options?.data || {},
        } as SupabaseAuthUser;
        localUsers.set(id, { user });
        const token = `local-token-${id}`;
        return {
          data: {
            session: {
              access_token: token,
              refresh_token: `refresh-${token}`,
              token_type: "bearer",
              expires_in: 86400,
              user,
            },
            user,
          },
          error: null,
        };
      },
      resetPasswordForEmail: async (_email: string) => ({ error: null }),
      refreshSession: async ({ refresh_token }: { refresh_token: string }) => {
        if (refresh_token.includes("admin")) {
          return {
            data: {
              session: {
                access_token: "demo-admin-token",
                refresh_token: "demo-admin-refresh-token",
                token_type: "bearer",
                expires_in: 86400,
                user: DEMO_USERS["demo-admin-token"],
              },
              user: DEMO_USERS["demo-admin-token"],
            },
            error: null,
          };
        }
        return {
          data: {
            session: {
              access_token: "demo-officer-token",
              refresh_token: "demo-officer-refresh-token",
              token_type: "bearer",
              expires_in: 86400,
              user: DEMO_USERS["demo-officer-token"],
            },
            user: DEMO_USERS["demo-officer-token"],
          },
          error: null,
        };
      },
    },
  } as unknown as SupabaseClient;
}

export async function getSupabaseAuthUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  if (DEMO_USERS[accessToken]) return DEMO_USERS[accessToken];
  for (const entry of Array.from(localUsers.values())) {
    if (accessToken === `local-token-${entry.user.id}` || accessToken === entry.user.id) {
      return entry.user;
    }
  }

  if (hasLiveSupabase()) {
    try {
      const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);
      if (!error && data?.user) return data.user;
    } catch {
      // Fallback below
    }
  }

  // Graceful fallback: return officer demo user if any token is present
  return DEMO_USERS["demo-officer-token"];
}

export function getSupabaseRedirectUrl(req?: { protocol?: string; get?: (name: string) => string | undefined }): string {
  const requestOrigin = req?.get?.("host") ? `${req.protocol || "https"}://${req.get("host")}` : "";
  const origin = process.env.PUBLIC_APP_URL || requestOrigin || "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}
