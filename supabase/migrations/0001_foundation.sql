-- =============================================================================
-- Phase 1 — Foundation
-- Netcapital DocConformance
--
-- Scope (per master spec §11 Phase 1 / §6 data model, foundation slice only):
--   units, users, roles, Row-Level Security.
-- Acceptance test this migration must satisfy:
--   "Two users in different units cannot see each other's data."
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum (
      'author',
      'reviewer',
      'approver',
      'unit_admin',
      'enterprise_governance'
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- units — Нэгж
-- -----------------------------------------------------------------------------
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_mn text not null,
  name_en text not null,
  parent_unit_id uuid references public.units(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.units is 'Нэгж — department/division. Every framework, rule set, and document belongs to a unit.';

-- -----------------------------------------------------------------------------
-- users — mirrors auth.users 1:1, adds unit + role + org-domain restriction.
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  unit_id uuid not null references public.units(id) on delete restrict,
  role public.user_role not null default 'author',
  created_at timestamptz not null default now(),
  constraint users_email_domain_check check (email like '%@netgroup.mn')
);

comment on table public.users is 'Application user profile. email must be @netgroup.mn (spec §2: Google OAuth restricted to netgroup.mn domain). id 1:1 with auth.users.';

create index if not exists users_unit_id_idx on public.users(unit_id);

-- -----------------------------------------------------------------------------
-- Helper functions (security definer: read the caller's own row without
-- recursing into the RLS policy that itself calls these functions).
-- -----------------------------------------------------------------------------
create or replace function public.current_unit_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select unit_id from public.users where id = auth.uid();
$$;

create or replace function public.current_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_enterprise_governance()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'enterprise_governance' from public.users where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_unit_admin_or_above()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role in ('unit_admin', 'enterprise_governance') from public.users where id = auth.uid()),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.units enable row level security;
alter table public.users enable row level security;

-- units: everyone signed-in can read (frameworks/units names are not secret
-- inside the org — enterprise_governance manages membership); only
-- enterprise_governance may create/alter units.
drop policy if exists units_select on public.units;
create policy units_select on public.units
  for select
  using (auth.uid() is not null);

drop policy if exists units_write on public.units;
create policy units_write on public.units
  for all
  using (public.is_enterprise_governance())
  with check (public.is_enterprise_governance());

-- users: a user sees their own row, every row in their own unit, and every
-- row if they hold the enterprise_governance role. This is the core
-- isolation rule the Phase 1 acceptance test exercises.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select
  using (
    id = auth.uid()
    or unit_id = public.current_unit_id()
    or public.is_enterprise_governance()
  );

-- Inserts: enterprise_governance can create a user in any unit; a unit_admin
-- can only create users inside their own unit.
drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert
  with check (
    public.is_enterprise_governance()
    or (public.current_role() = 'unit_admin' and unit_id = public.current_unit_id())
  );

-- Updates: same scoping as insert, plus a user may update their own
-- non-privileged profile fields (enforced at the application layer for
-- which columns; RLS only gates the row).
drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update
  using (
    id = auth.uid()
    or public.is_enterprise_governance()
    or (public.current_role() = 'unit_admin' and unit_id = public.current_unit_id())
  )
  with check (
    public.is_enterprise_governance()
    or (public.current_role() = 'unit_admin' and unit_id = public.current_unit_id())
    or id = auth.uid()
  );

-- Deletes: enterprise_governance only.
drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete
  using (public.is_enterprise_governance());

-- -----------------------------------------------------------------------------
-- Onboarding: a brand-new @netgroup.mn Google sign-in has no unit yet. Rather
-- than block sign-in, auto-provision a minimal profile in a holding unit
-- ("UNASSIGNED") with the lowest role; a unit_admin/enterprise_governance
-- then moves them into a real unit from Админ (§7.8). This keeps auth.users
-- and public.users in lockstep without asking OAuth to know about units.
-- -----------------------------------------------------------------------------
insert into public.units (code, name_mn, name_en)
values ('UNASSIGNED', 'Хуваарилагдаагүй', 'Unassigned')
on conflict (code) do nothing;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unassigned_unit_id uuid;
begin
  select id into v_unassigned_unit_id from public.units where code = 'UNASSIGNED';

  insert into public.users (id, email, name, unit_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_unassigned_unit_id,
    'author'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
