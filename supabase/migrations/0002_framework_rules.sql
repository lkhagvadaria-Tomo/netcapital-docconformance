-- =============================================================================
-- Phase 2 — Framework & Rules
-- Netcapital DocConformance
--
-- Scope (§11 Phase 2 / §6 data model, framework/rule-set slice):
--   framework_documents, rule_sets, rules, ai_runs (§10 non-negotiable:
--   every AI call is logged).
-- Acceptance test this migration must satisfy (§11):
--   "Extract a rule set from a provided framework document; a reviewer can
--   accept/edit/reject each rule; an unapproved set cannot be selected in
--   an audit."
-- The "cannot be selected in an audit" half is enforced in application code
-- (src/lib/ruleSets.ts — Phase 3's audit runner will use it) since there is
-- no audits table yet; this migration's job is the data + RLS underneath.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'framework_kind') then
    create type public.framework_kind as enum ('normative', 'consuming');
  end if;
  if not exists (select 1 from pg_type where typname = 'rule_set_status') then
    create type public.rule_set_status as enum ('draft', 'approved', 'retired');
  end if;
  if not exists (select 1 from pg_type where typname = 'rule_type') then
    -- §4.1 taxonomy — exactly these eight, nothing unit-specific. Extend
    -- this enum (never special-case a unit) if a rule genuinely doesn't fit.
    create type public.rule_type as enum (
      'R-LINK', 'R-CODE', 'R-LAYER', 'R-AUTH',
      'R-META', 'R-STATE', 'R-DECISION', 'R-FEED'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'rule_review_status') then
    create type public.rule_review_status as enum ('pending', 'accepted', 'edited', 'rejected');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- framework_documents — Лавлагаа баримт
-- -----------------------------------------------------------------------------
create table if not exists public.framework_documents (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  register_code text not null,
  title text not null,
  version text not null,
  kind public.framework_kind not null default 'normative',
  -- Phase 2 scope: pasted/extracted plain text of the document. Phase 8
  -- (multi-unit rollout / Drive ingest) may add a source_ref pointing at a
  -- Drive file instead — keep both columns so that migration is additive.
  source_ref text,
  source_text text,
  superseded_by_id uuid references public.framework_documents(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  pinned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- The whole point of Stage 2 (§4.2): pin the EXACT cited version. Two
  -- rows for the same register_code+version in the same unit would make
  -- "which one did the OKR cite" ambiguous.
  unique (unit_id, register_code, version)
);

comment on table public.framework_documents is 'A version-pinned document that imposes rules (normative) or requires inputs (consuming). Never silently substitute a newer version for the one an OKR cited.';

-- -----------------------------------------------------------------------------
-- rule_sets — Дүрмийн багц (one per framework_document version)
-- -----------------------------------------------------------------------------
create table if not exists public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  framework_document_id uuid not null references public.framework_documents(id) on delete cascade,
  status public.rule_set_status not null default 'draft',
  extracted_by uuid references public.users(id) on delete set null,
  extracted_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.rule_sets is 'status must be approved (a human act — §8) before src/lib/ruleSets.ts:isRuleSetUsableInAudit() will let an audit run use it.';

-- -----------------------------------------------------------------------------
-- rules — Дүрэм (one extracted, testable requirement)
-- -----------------------------------------------------------------------------
create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.rule_sets(id) on delete cascade,
  code text not null,
  citation text not null,
  type public.rule_type not null,
  statement_mn text not null,
  statement_en text,
  weight numeric not null default 1 check (weight >= 0),
  detection_spec jsonb not null default '{}'::jsonb,
  remediation_template text,
  blocking boolean not null default false,
  review_status public.rule_review_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.rules is 'review_status starts pending; a rule_set can only move to approved once every rule here has been accepted, edited, or rejected by a human (§7.3, §8).';

create index if not exists rules_rule_set_id_idx on public.rules(rule_set_id);

-- -----------------------------------------------------------------------------
-- ai_runs — every AI call, for auditability (§10 non-negotiable)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  framework_document_id uuid references public.framework_documents(id) on delete set null,
  prompt_version text not null,
  model text not null,
  input_hash text not null,
  output text,
  input_tokens integer,
  output_tokens integer,
  ran_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.ai_runs is 'Written by the extract-rules Edge Function (service role) for every call it makes to Claude — never by client code directly.';

-- -----------------------------------------------------------------------------
-- Helper: does the caller manage this unit's rule sets (reviewer or above)?
-- -----------------------------------------------------------------------------
create or replace function public.can_review_rules()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role in ('reviewer', 'unit_admin', 'enterprise_governance') from public.users where id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.framework_documents enable row level security;
alter table public.rule_sets enable row level security;
alter table public.rules enable row level security;
alter table public.ai_runs enable row level security;

drop policy if exists framework_documents_select on public.framework_documents;
create policy framework_documents_select on public.framework_documents
  for select
  using (unit_id = public.current_unit_id() or public.is_enterprise_governance());

drop policy if exists framework_documents_write on public.framework_documents;
create policy framework_documents_write on public.framework_documents
  for all
  using (
    public.is_enterprise_governance()
    or (public.is_unit_admin_or_above() and unit_id = public.current_unit_id())
  )
  with check (
    public.is_enterprise_governance()
    or (public.is_unit_admin_or_above() and unit_id = public.current_unit_id())
  );

drop policy if exists rule_sets_select on public.rule_sets;
create policy rule_sets_select on public.rule_sets
  for select
  using (
    public.is_enterprise_governance()
    or exists (
      select 1 from public.framework_documents fd
      where fd.id = rule_sets.framework_document_id
        and fd.unit_id = public.current_unit_id()
    )
  );

drop policy if exists rule_sets_write on public.rule_sets;
create policy rule_sets_write on public.rule_sets
  for all
  using (
    public.is_enterprise_governance()
    or (
      public.can_review_rules()
      and exists (
        select 1 from public.framework_documents fd
        where fd.id = rule_sets.framework_document_id
          and fd.unit_id = public.current_unit_id()
      )
    )
  )
  with check (
    public.is_enterprise_governance()
    or (
      public.can_review_rules()
      and exists (
        select 1 from public.framework_documents fd
        where fd.id = rule_sets.framework_document_id
          and fd.unit_id = public.current_unit_id()
      )
    )
  );

drop policy if exists rules_select on public.rules;
create policy rules_select on public.rules
  for select
  using (
    public.is_enterprise_governance()
    or exists (
      select 1 from public.rule_sets rs
      join public.framework_documents fd on fd.id = rs.framework_document_id
      where rs.id = rules.rule_set_id
        and fd.unit_id = public.current_unit_id()
    )
  );

drop policy if exists rules_write on public.rules;
create policy rules_write on public.rules
  for all
  using (
    public.is_enterprise_governance()
    or (
      public.can_review_rules()
      and exists (
        select 1 from public.rule_sets rs
        join public.framework_documents fd on fd.id = rs.framework_document_id
        where rs.id = rules.rule_set_id
          and fd.unit_id = public.current_unit_id()
      )
    )
  )
  with check (
    public.is_enterprise_governance()
    or (
      public.can_review_rules()
      and exists (
        select 1 from public.rule_sets rs
        join public.framework_documents fd on fd.id = rs.framework_document_id
        where rs.id = rules.rule_set_id
          and fd.unit_id = public.current_unit_id()
      )
    )
  );

-- ai_runs: governance-only visibility (an audit log, not a working table);
-- writes come from the Edge Function's service-role key, which bypasses
-- RLS entirely, so this policy only ever governs reads from the app.
drop policy if exists ai_runs_select on public.ai_runs;
create policy ai_runs_select on public.ai_runs
  for select
  using (
    public.is_enterprise_governance()
    or (public.is_unit_admin_or_above() and unit_id = public.current_unit_id())
  );
