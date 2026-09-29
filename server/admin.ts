import { getSupabaseAdmin, type AppUser } from "./supabase";
import { getConnectorRegistry, verifyGovernmentSource } from "./connectors";
import { query, recordAudit } from "./postgres";

export type AdminFilters = { userId?: string; action?: string; entity?: string; status?: string; from?: string; to?: string };

const connectorNames = [
  "Udyam / MSME", "GSTN", "PAN / Income Tax", "MCA21", "Startup India", "NSIC", "EPFO", "ESIC", "DigiLocker", "Make in India", "BIS / DPIIT", "Blacklisting / Debarment", "GeM",
];

function statusFromValue(value: boolean): "Operational" | "Not Configured" | "Error" { return value ? "Operational" : "Not Configured"; }

export async function getAdminOverview(user: AppUser) {
  const [officers, activeOfficers, tenders, bidders, verifications, pendingReviews, rules, connectors] = await Promise.all([
    query(`select count(*)::int as count from public.organization_members where organization_id = $1 and role = 'officer'`, [user.organizationId]),
    query(`select count(*)::int as count from public.organization_members om join public.profiles p on p.id = om.user_id where om.organization_id = $1 and om.role = 'officer' and coalesce(p.account_status, 'Active') = 'Active'`, [user.organizationId]),
    query(`select count(*)::int as count from public.tenders where organization_id = $1`, [user.organizationId]),
    query(`select count(*)::int as count from public.bidders where organization_id = $1`, [user.organizationId]),
    query(`select count(*)::int as count from public.compliance_checks where organization_id = $1`, [user.organizationId]),
    query(`select count(*)::int as count from public.compliance_checks where organization_id = $1 and result in ('Pending', 'Needs Review')`, [user.organizationId]),
    query(`select count(*)::int as count from public.compliance_rules where organization_id = $1 and status = 'Active'`, [user.organizationId]),
    getAdminConnectors(user),
  ]);
  const health = await getSystemHealth(user);
  return {
    cards: {
      totalOfficers: Number(officers.rows[0]?.count ?? 0), activeOfficers: Number(activeOfficers.rows[0]?.count ?? 0), totalTenders: Number(tenders.rows[0]?.count ?? 0), totalBidders: Number(bidders.rows[0]?.count ?? 0), totalVerifications: Number(verifications.rows[0]?.count ?? 0), pendingReviews: Number(pendingReviews.rows[0]?.count ?? 0), activeRules: Number(rules.rows[0]?.count ?? 0),
    },
    health,
    connectors: connectors.rows,
  };
}

export async function listOfficers(user: AppUser) {
  const result = await query(`select p.id, p.full_name as "fullName", p.email, p.organization_name as organization, om.role, coalesce(p.account_status, 'Active') as status, p.last_login_at as "lastLogin", p.created_at as "createdAt" from public.organization_members om join public.profiles p on p.id = om.user_id where om.organization_id = $1 order by p.created_at desc`, [user.organizationId]);
  return result.rows.map((row) => ({ ...row, role: row.role === "administrator" ? "admin" : "procurement_officer", lastLogin: row.lastLogin ? new Date(String(row.lastLogin)).toLocaleString("en-IN") : "Never", createdAt: row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString("en-IN") : "—" }));
}

export async function inviteOfficer(user: AppUser, input: { email: string; fullName: string; organization: string }) {
  const { data, error } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(input.email, { data: { full_name: input.fullName, organization: input.organization, role: "officer" } });
  if (error || !data.user) throw new Error(error?.message || "Unable to create officer invitation");
  await query(`insert into public.profiles (id, full_name, organization_name, role, account_status) values ($1, $2, $3, 'officer', 'Active') on conflict (id) do update set full_name = excluded.full_name, organization_name = excluded.organization_name, updated_at = now()`, [data.user.id, input.fullName, input.organization]);
  await query(`insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'officer') on conflict (organization_id, user_id) do update set role = 'officer'`, [user.organizationId, data.user.id]);
  await recordAudit(user, "Admin created officer", input.email, "Completed", { officerId: data.user.id });
  return { id: data.user.id, email: input.email, fullName: input.fullName };
}

export async function setOfficerStatus(user: AppUser, officerId: string, status: "Active" | "Disabled") {
  if (officerId === user.id) throw new Error("You cannot disable your own account");
  const membership = await query<{ id: string }>(`select user_id as id from public.organization_members where organization_id = $1 and user_id = $2`, [user.organizationId, officerId]);
  if (!membership.rows[0]) throw new Error("Officer is not in this organization");
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(officerId, { ban_duration: status === "Disabled" ? "876000h" : "none" });
  if (error) throw new Error(error.message);
  await query(`update public.profiles set account_status = $1, updated_at = now() where id = $2`, [status, officerId]);
  await recordAudit(user, `Admin ${status.toLowerCase()} officer`, officerId, "Completed", { officerId, status });
  return { success: true as const, status };
}

export async function setOfficerRole(user: AppUser, officerId: string, role: "admin" | "procurement_officer") {
  if (officerId === user.id && role !== "admin") throw new Error("You cannot remove your own admin access");
  const dbRole = role === "admin" ? "administrator" : "officer";
  const membership = await query<{ id: string }>(`select user_id as id from public.organization_members where organization_id = $1 and user_id = $2`, [user.organizationId, officerId]);
  if (!membership.rows[0]) throw new Error("Officer is not in this organization");
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(officerId, { app_metadata: { role: dbRole } });
  if (error) throw new Error(error.message);
  await query(`update public.profiles set role = $1, updated_at = now() where id = $2`, [dbRole, officerId]);
  await query(`update public.organization_members set role = $1 where organization_id = $2 and user_id = $3`, [dbRole, user.organizationId, officerId]);
  await recordAudit(user, "Admin changed officer role", officerId, "Completed", { officerId, role });
  return { success: true as const, role };
}

export async function listRules(user: AppUser) {
  const result = await query(`select id, name, category, description, applicable_condition as "applicableCondition", status, updated_at as "updatedAt" from public.compliance_rules where organization_id = $1 order by category, name`, [user.organizationId]);
  return result.rows.map((row) => ({ ...row, updatedAt: new Date(String(row.updatedAt)).toLocaleString("en-IN") }));
}

export async function createRule(user: AppUser, input: { name: string; category: string; description: string; applicableCondition: string }) {
  const result = await query(`insert into public.compliance_rules (organization_id, name, category, description, applicable_condition, created_by, updated_by) values ($1, $2, $3, $4, $5, $6, $6) returning id, name, category, description, applicable_condition as "applicableCondition", status`, [user.organizationId, input.name, input.category, input.description, input.applicableCondition, user.id]);
  await recordAudit(user, "Admin created compliance rule", input.name, "Completed", { ruleId: result.rows[0].id });
  return result.rows[0];
}

export async function setRuleStatus(user: AppUser, ruleId: string, status: "Active" | "Inactive") {
  const result = await query(`update public.compliance_rules set status = $1, updated_by = $2, updated_at = now() where id = $3 and organization_id = $4 returning id, name, status`, [status, user.id, ruleId, user.organizationId]);
  if (!result.rows[0]) throw new Error("Compliance rule not found");
  await recordAudit(user, `Admin ${status === "Active" ? "activated" : "deactivated"} compliance rule`, result.rows[0].name, "Completed", { ruleId, status });
  return result.rows[0];
}

export async function getAdminConnectors(user: AppUser) {
  const registry = await getConnectorRegistry(user.organizationId);
  const byName = new Map(registry.rows.map((row) => [String(row.name), row]));
  return { rows: connectorNames.map((name) => { const row = byName.get(name); return { id: row?.id ?? name, name, purpose: row?.description ?? "Approved government source connector", status: row?.status ?? "Not Configured", configurationState: row?.status ?? "Not Configured", lastChecked: row?.lastChecked ?? "Not checked" }; }) };
}

export async function checkConnector(user: AppUser, name: string, payload: Record<string, unknown> = {}) {
  const result = await verifyGovernmentSource(name, payload);
  await query(`update public.government_sources set last_checked = now(), status = $1, configuration_state = $1, updated_at = now() where organization_id = $2 and name = $3`, [result.status, user.organizationId, name]);
  await recordAudit(user, "Admin checked government connector", name, result.status, { connector: name });
  return result;
}

export async function listAuditLogs(user: AppUser, filters: AdminFilters = {}) {
  const clauses = ["ae.organization_id = $1"]; const values: unknown[] = [user.organizationId];
  const add = (sql: string, value: unknown) => { values.push(value); clauses.push(sql.replace("$VALUE", `$${values.length}`)); };
  if (filters.userId) add("ae.user_id = $VALUE", filters.userId); if (filters.action) add("ae.action ilike $VALUE", `%${filters.action}%`); if (filters.entity) add("ae.entity ilike $VALUE", `%${filters.entity}%`); if (filters.status) add("ae.status ilike $VALUE", `%${filters.status}%`); if (filters.from) add("ae.created_at >= $VALUE::timestamptz", filters.from); if (filters.to) add("ae.created_at < ($VALUE::date + interval '1 day')", filters.to);
  const result = await query(`select ae.id, ae.created_at as timestamp, coalesce(p.full_name, 'System') as user, coalesce(om.role, 'system') as role, ae.action, ae.entity, ae.status, ae.metadata from public.audit_events ae left join public.profiles p on p.id = ae.user_id left join public.organization_members om on om.organization_id = ae.organization_id and om.user_id = ae.user_id where ${clauses.join(" and ")} order by ae.created_at desc limit 250`, values);
  return result.rows.map((row) => ({ ...row, timestamp: new Date(String(row.timestamp)).toLocaleString("en-IN"), role: row.role === "administrator" ? "admin" : row.role === "officer" ? "procurement_officer" : row.role }));
}

export async function getSystemHealth(user: AppUser) {
  const checkedAt = new Date().toISOString();
  const checks = await Promise.allSettled([
    query("select 1 as ok"),
    getSupabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1 }),
    getSupabaseAdmin().storage.listBuckets(),
  ]);
  const succeeded = (result: PromiseSettledResult<unknown>) => result.status === "fulfilled" && !(result.value as { error?: unknown } | undefined)?.error;
  const db = succeeded(checks[0]) ? "Operational" : "Error";
  const auth = succeeded(checks[1]) ? "Operational" : "Error";
  const storage = succeeded(checks[2]) ? "Operational" : "Error";
  const ai = process.env.GEMINI_API_KEY ? "Operational" : "Not Configured";
  const processing = process.env.GEMINI_API_KEY ? "Operational" : "Not Configured";
  const connectorRows = (await getAdminConnectors(user)).rows;
  const configured = connectorRows.some((connector) => connector.status === "Connected");
  return { checkedAt, services: [{ name: "Database", status: db }, { name: "Authentication", status: auth }, { name: "File storage", status: storage }, { name: "AI service", status: ai }, { name: "OCR / document processing", status: processing }, { name: "Backend API", status: "Operational" }, { name: "Government connectors", status: statusFromValue(configured) }] };
}

export async function getAdminSettings(user: AppUser) {
  const result = await query(`select setting_key as key, setting_value as value, updated_at as "updatedAt" from public.system_settings where organization_id = $1 order by setting_key`, [user.organizationId]);
  return result.rows;
}

export async function updateAdminSetting(user: AppUser, key: string, value: Record<string, unknown>) {
  const allowed = new Set(["organization", "compliance_defaults", "notifications", "security"]);
  if (!allowed.has(key)) throw new Error("Unsupported setting");
  const result = await query(`insert into public.system_settings (organization_id, setting_key, setting_value, updated_by) values ($1, $2, $3::jsonb, $4) on conflict (organization_id, setting_key) do update set setting_value = excluded.setting_value, updated_by = excluded.updated_by, updated_at = now() returning setting_key as key, setting_value as value`, [user.organizationId, key, JSON.stringify(value), user.id]);
  await recordAudit(user, "Admin updated system setting", key, "Completed", { key });
  return result.rows[0];
}
