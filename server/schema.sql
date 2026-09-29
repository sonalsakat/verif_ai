create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  organization_name text,
  role text not null default 'officer' check (role in ('officer', 'administrator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'officer' check (role in ('officer', 'administrator')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.tenders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null,
  title text not null,
  department text not null,
  description text,
  submission_deadline date,
  bid_opening_date date,
  estimated_value numeric(18, 2),
  status text not null default 'Documents Pending',
  progress integer not null default 0 check (progress between 0 and 100),
  document_key text,
  document_name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create table if not exists public.tender_requirements (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  title text not null,
  category text not null,
  evidence_required text not null,
  source text not null default 'Officer added',
  status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bidders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  registration_id text not null,
  gstin text,
  pan text,
  status text not null default 'Pending',
  compliance_score integer not null default 0 check (compliance_score between 0 and 100),
  risk text not null default 'Medium' check (risk in ('Low', 'Medium', 'High')),
  last_checked timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  bidder_id uuid not null references public.bidders(id) on delete cascade,
  submitted_at timestamptz,
  status text not null default 'Under Verification',
  created_at timestamptz not null default now(),
  unique (tender_id, bidder_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid references public.tenders(id) on delete set null,
  bidder_id uuid references public.bidders(id) on delete set null,
  file_key text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  document_type text not null default 'Other',
  processing_status text not null default 'Uploaded',
  verification_status text not null default 'Pending',
  extracted_text text,
  extraction jsonb,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  extracted_fields jsonb not null default '{}'::jsonb,
  raw_text text,
  model text,
  confidence numeric(5, 4),
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  bidder_id uuid not null references public.bidders(id) on delete cascade,
  requirement_id uuid references public.tender_requirements(id) on delete set null,
  requirement text not null,
  evidence text not null default 'Not submitted',
  source text not null default 'Submitted document',
  result text not null default 'Pending',
  confidence text not null default 'Low',
  detail text not null default '',
  rule text not null default '',
  checked_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.compliance_checks(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  source text not null,
  document_name text not null default '—',
  page_number text not null default '—',
  extracted_value text not null default '',
  relevant_evidence text not null default '',
  verification_date timestamptz not null default now(),
  source_status text not null default 'Document evidence',
  confidence text not null default 'Low',
  created_at timestamptz not null default now()
);

create table if not exists public.contradictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  bidder_id uuid not null references public.bidders(id) on delete cascade,
  requirement_id uuid references public.tender_requirements(id) on delete set null,
  issue text not null,
  values jsonb not null default '[]'::jsonb,
  status text not null default 'Needs Review',
  created_at timestamptz not null default now()
);

create table if not exists public.government_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'Not configured',
  last_checked timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.officer_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  bidder_id uuid not null references public.bidders(id) on delete cascade,
  decision text not null check (decision in ('Qualified', 'Not Qualified', 'Needs Clarification')),
  comment text not null,
  officer_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  bidder_id uuid not null references public.bidders(id) on delete cascade,
  report_type text not null default 'Compliance Report',
  file_key text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists tenders_organization_idx on public.tenders(organization_id, created_at desc);
create index if not exists requirements_tender_idx on public.tender_requirements(tender_id, created_at);
create index if not exists bidders_organization_idx on public.bidders(organization_id, created_at desc);
create index if not exists documents_organization_idx on public.documents(organization_id, uploaded_at desc);
create index if not exists checks_bidder_idx on public.compliance_checks(bidder_id, checked_at desc);
create index if not exists checks_tender_idx on public.compliance_checks(tender_id, checked_at desc);
create index if not exists audit_organization_idx on public.audit_events(organization_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.tenders enable row level security;
alter table public.tender_requirements enable row level security;
alter table public.bidders enable row level security;
alter table public.bids enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.compliance_checks enable row level security;
alter table public.evidence enable row level security;
alter table public.contradictions enable row level security;
alter table public.government_sources enable row level security;
alter table public.audit_events enable row level security;
alter table public.officer_decisions enable row level security;
alter table public.reports enable row level security;

alter table public.profiles add column if not exists account_status text not null default 'Active';
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.government_sources add column if not exists purpose text not null default '';
alter table public.government_sources add column if not exists configuration_state text not null default 'Not Configured';
alter table public.government_sources add column if not exists updated_at timestamptz not null default now();

create table if not exists public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null,
  description text not null default '',
  applicable_condition text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, setting_key)
);

create index if not exists compliance_rules_org_idx on public.compliance_rules(organization_id, status, updated_at desc);
create index if not exists system_settings_org_idx on public.system_settings(organization_id, setting_key);
create index if not exists profiles_org_status_idx on public.organization_members(organization_id, role, created_at desc);

alter table public.compliance_rules enable row level security;
alter table public.system_settings enable row level security;
