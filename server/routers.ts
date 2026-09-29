import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSupabaseAnon, getSupabaseRedirectUrl, getSupabaseUrl, DEMO_USERS } from "./supabase";
import { getWorkspaceSnapshot, createTender, createBidder, createRequirement, recordOfficerDecision, runVerification } from "./workspace";
import { uploadAndProcessDocument, getSignedDocumentUrl } from "./document-processing";
import { verifyGovernmentSource } from "./connectors";
import { createRule, getAdminConnectors, getAdminOverview, getAdminSettings, getSystemHealth, inviteOfficer, listAuditLogs, listOfficers, listRules, setOfficerRole, setOfficerStatus, setRuleStatus, updateAdminSetting, checkConnector } from "./admin";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.portalRole !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access is required." });
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    config: publicProcedure.query(() => ({ url: getSupabaseUrl(), anonKey: process.env.SUPABASE_ANON_KEY ?? "" })),
    me: publicProcedure.query(opts => opts.ctx.user),
    demoSignIn: publicProcedure.input(z.object({ role: z.enum(["officer", "admin"]) })).mutation(async ({ input }) => {
      const token = input.role === "admin" ? "demo-admin-token" : "demo-officer-token";
      const user = DEMO_USERS[token];
      return {
        session: {
          access_token: token,
          refresh_token: `${token}-refresh`,
          token_type: "bearer",
          expires_in: 86400,
          user,
        },
        user,
      };
    }),
    signIn: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(8) })).mutation(async ({ input }) => {
      const { data, error } = await getSupabaseAnon().auth.signInWithPassword(input);
      if (error || !data.session) throw new TRPCError({ code: "UNAUTHORIZED", message: error?.message || "Unable to sign in" });
      return { session: data.session, user: data.user };
    }),
    signUp: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(8), fullName: z.string().min(2), organization: z.string().min(2) })).mutation(async ({ input }) => {
      const { data, error } = await getSupabaseAnon().auth.signUp({ email: input.email, password: input.password, options: { data: { full_name: input.fullName, organization: input.organization } } });
      if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return { session: data.session, user: data.user, needsEmailConfirmation: !data.session };
    }),
    requestReset: publicProcedure.input(z.object({ email: z.string().email() })).mutation(async ({ ctx, input }) => {
      const { error } = await getSupabaseAnon().auth.resetPasswordForEmail(input.email, { redirectTo: getSupabaseRedirectUrl(ctx.req) });
      if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return { success: true as const };
    }),
    updatePassword: publicProcedure.input(z.object({ accessToken: z.string().min(20), password: z.string().min(8) })).mutation(async ({ input }) => {
      const authUser = await (await import("./supabase")).getSupabaseAuthUser(input.accessToken);
      if (!authUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "The recovery link is invalid or expired." });
      const { error } = await (await import("./supabase")).getSupabaseAdmin().auth.admin.updateUserById(authUser.id, { password: input.password });
      if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      return { success: true as const, userId: authUser.id };
    }),
    refresh: publicProcedure.input(z.object({ refreshToken: z.string().min(20) })).mutation(async ({ input }) => {
      const { data, error } = await getSupabaseAnon().auth.refreshSession({ refresh_token: input.refreshToken });
      if (error || !data.session) throw new TRPCError({ code: "UNAUTHORIZED", message: error?.message || "Session expired" });
      return { session: data.session, user: data.user };
    }),
    logout: publicProcedure.mutation(() => ({ success: true as const })),
  }),

  workspace: router({
    snapshot: protectedProcedure.query(({ ctx }) => getWorkspaceSnapshot(ctx.user)),
    createTender: protectedProcedure.input(z.object({ title: z.string().min(3), department: z.string().min(2), description: z.string().optional(), submissionDeadline: z.string().optional(), bidOpeningDate: z.string().optional(), estimatedValue: z.string().optional() })).mutation(({ ctx, input }) => createTender(ctx.user, input)),
    createBidder: protectedProcedure.input(z.object({ name: z.string().min(2), registrationId: z.string().min(3), gstin: z.string().optional(), pan: z.string().optional(), tenderId: z.string().uuid().optional() })).mutation(({ ctx, input }) => createBidder(ctx.user, input)),
    addRequirement: protectedProcedure.input(z.object({ tenderId: z.string().uuid(), title: z.string().min(3), category: z.string().min(2), evidenceRequired: z.string().min(3) })).mutation(({ ctx, input }) => createRequirement(ctx.user, input)),
    recordDecision: protectedProcedure.input(z.object({ tenderId: z.string().uuid(), bidderId: z.string().uuid(), decision: z.enum(["Qualified", "Not Qualified", "Needs Clarification"]), comment: z.string().min(10) })).mutation(({ ctx, input }) => recordOfficerDecision(ctx.user, input)),
    runVerification: protectedProcedure.input(z.object({ tenderId: z.string().uuid(), bidderId: z.string().uuid() })).mutation(({ ctx, input }) => runVerification(ctx.user, input)),
  }),

  documents: router({
    upload: protectedProcedure.input(z.object({ fileName: z.string().min(1), mimeType: z.string().min(1), dataBase64: z.string().min(10), tenderId: z.string().uuid().optional(), bidderId: z.string().uuid().optional() })).mutation(({ ctx, input }) => uploadAndProcessDocument(ctx.user, { buffer: Buffer.from(input.dataBase64, "base64"), fileName: input.fileName, mimeType: input.mimeType, tenderId: input.tenderId, bidderId: input.bidderId })),
    signedUrl: protectedProcedure.input(z.object({ documentId: z.string().uuid() })).mutation(({ ctx, input }) => getSignedDocumentUrl(ctx.user, input.documentId)),
  }),

  connectors: router({
    verify: protectedProcedure.input(z.object({ name: z.string().min(1), payload: z.record(z.string(), z.unknown()) })).mutation(async ({ ctx, input }) => {
      const result = await verifyGovernmentSource(input.name, input.payload);
      return result;
    }),
  }),

  admin: router({
    overview: adminProcedure.query(({ ctx }) => getAdminOverview(ctx.user)),
    officers: router({
      list: adminProcedure.query(({ ctx }) => listOfficers(ctx.user)),
      invite: adminProcedure.input(z.object({ email: z.string().email(), fullName: z.string().min(2), organization: z.string().min(2) })).mutation(({ ctx, input }) => inviteOfficer(ctx.user, input)),
      setStatus: adminProcedure.input(z.object({ officerId: z.string().uuid(), status: z.enum(["Active", "Disabled"]) })).mutation(({ ctx, input }) => setOfficerStatus(ctx.user, input.officerId, input.status)),
      setRole: adminProcedure.input(z.object({ officerId: z.string().uuid(), role: z.enum(["admin", "procurement_officer"]) })).mutation(({ ctx, input }) => setOfficerRole(ctx.user, input.officerId, input.role)),
    }),
    rules: router({
      list: adminProcedure.query(({ ctx }) => listRules(ctx.user)),
      create: adminProcedure.input(z.object({ name: z.string().min(3), category: z.string().min(2), description: z.string().min(3), applicableCondition: z.string().min(3) })).mutation(({ ctx, input }) => createRule(ctx.user, input)),
      setStatus: adminProcedure.input(z.object({ ruleId: z.string().uuid(), status: z.enum(["Active", "Inactive"]) })).mutation(({ ctx, input }) => setRuleStatus(ctx.user, input.ruleId, input.status)),
    }),
    connectors: router({
      list: adminProcedure.query(({ ctx }) => getAdminConnectors(ctx.user)),
      check: adminProcedure.input(z.object({ name: z.string().min(1), payload: z.record(z.string(), z.unknown()).optional() })).mutation(({ ctx, input }) => checkConnector(ctx.user, input.name, input.payload ?? {})),
    }),
    audit: router({
      list: adminProcedure.input(z.object({ userId: z.string().uuid().optional(), action: z.string().optional(), entity: z.string().optional(), status: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).optional()).query(({ ctx, input }) => listAuditLogs(ctx.user, input ?? {})),
    }),
    health: adminProcedure.query(({ ctx }) => getSystemHealth(ctx.user)),
    settings: router({
      list: adminProcedure.query(({ ctx }) => getAdminSettings(ctx.user)),
      update: adminProcedure.input(z.object({ key: z.string(), value: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => updateAdminSetting(ctx.user, input.key, input.value)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
