#!/usr/bin/env node
// Applies every file in supabase/migrations/, in order, to a real
// (in-memory, WASM) Postgres engine via PGlite — NOT a syntax eyeball, an
// actual execution. This exists because this repo was scaffolded in a
// sandbox with no Docker daemon (so `supabase start`'s local stack, which
// would normally be how you exercise migrations before a real project
// exists, is unavailable — see README "Known environment limitations").
//
// It stubs the tiny slice of Supabase's own `auth` schema our migrations
// touch (auth.users, auth.uid()) — real Supabase provides both for real;
// this only needs to be faithful enough to let our DDL, RLS policies and
// trigger functions actually run.
//
// IMPORTANT: RLS in Postgres does not apply to a table's owner (or a
// superuser) — only to other roles. The default PGlite connection owns
// every table we create, so a naive check here would silently bypass every
// policy and "pass" even if RLS were broken or missing entirely. To make
// these checks real, we create a non-owning `authenticated` role (mirroring
// what Supabase's own `authenticated` role is: a role the platform queries
// as, that owns nothing) and run every RLS-sensitive query through it via
// `asUser()` below.
//
// Run: npm run db:verify

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrationsDir = path.join(root, "supabase", "migrations");

const db = new PGlite({ extensions: { pgcrypto } });

/** Switch the session to the non-owning `authenticated` role, impersonating one user (RLS is enforced from here on). */
async function asUser(uid) {
  await db.exec(`set role authenticated; set app.current_uid = '${uid}';`);
}
/** Back to the owning/superuser connection — RLS bypassed (used only for fixture setup, never for assertions). */
async function asSuperuser() {
  await db.exec(`reset role; reset app.current_uid;`);
}

async function applyAllMigrations() {
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create or replace function auth.uid() returns uuid
      language sql stable as $$ select current_setting('app.current_uid', true)::uuid $$;
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    await db.exec(sql);
    console.log(`✓ ${file}`);
  }

  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
    end $$;
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
  `);
}

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures++;
  }
}

async function phase1Checks() {
  console.log("\nPhase 1 — Foundation");

  // Fixture: a fresh Google sign-in. Real Supabase's GoTrue writes
  // auth.users directly (bypassing RLS by design), so this one insert
  // stays on the superuser connection; the trigger it fires is exactly
  // what we're testing.
  await db.exec(
    `insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@netgroup.mn');`
  );
  const auto = await db.query(
    `select u.code as unit_code, pu.role from public.users pu join public.units u on u.id = pu.unit_id where pu.id = '11111111-1111-1111-1111-111111111111';`
  );
  check(
    "a fresh Google sign-in auto-lands in UNASSIGNED (on_auth_user_created trigger)",
    auto.rows[0]?.unit_code === "UNASSIGNED"
  );

  // A non-enterprise_governance caller must not be able to create a unit —
  // exercised as `authenticated`/this brand-new author, so it is a real
  // negative proof of `units_write`, not just a read of the SQL.
  await asUser("11111111-1111-1111-1111-111111111111");
  let unitInsertRejected = false;
  try {
    await db.query(
      `insert into public.units (code, name_mn, name_en) values ('SHOULDFAIL','x','y');`
    );
  } catch (e) {
    unitInsertRejected = true;
  }
  check(
    "a non-enterprise_governance user cannot create a unit (units_write policy)",
    unitInsertRejected
  );

  // Fixture: create the test unit and move the user into it as unit_admin
  // (what Админ does) — via the service-role-equivalent superuser
  // connection, since Phase 1's onboarding flow doesn't yet have a UI for
  // "promote to enterprise_governance", only Supabase itself can do that
  // bootstrap step for a brand-new project.
  await asSuperuser();
  await db.exec(
    `insert into public.units (id, code, name_mn, name_en) values ('22222222-2222-2222-2222-222222222222','TESTUNIT','Тест нэгж','Test Unit');`
  );
  await db.exec(
    `update public.users set unit_id = '22222222-2222-2222-2222-222222222222', role = 'unit_admin' where id = '11111111-1111-1111-1111-111111111111';`
  );

  await asUser("11111111-1111-1111-1111-111111111111");
  const r = await db.query(
    `select public.current_unit_id() as u, public.current_role() as r, public.is_unit_admin_or_above() as is_admin;`
  );
  check(
    "current_unit_id()/current_role() reflect an Админ move out of UNASSIGNED",
    r.rows[0]?.u === "22222222-2222-2222-2222-222222222222" &&
      r.rows[0]?.r === "unit_admin" &&
      r.rows[0]?.is_admin === true
  );

  await asSuperuser();
  let domainRejected = false;
  try {
    await db.exec(
      `insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'someone@gmail.com');`
    );
  } catch (e) {
    domainRejected = e.code === "23514"; // check_violation
  }
  check(
    "a non-@netgroup.mn email is rejected end-to-end (defense in depth behind the OAuth hd= gate)",
    domainRejected
  );

  // Fixture for phase2Checks: a second unit + user, kept in UNASSIGNED-free
  // state so phase2Checks can prove cross-unit isolation on the new tables.
  await db.exec(`insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'b@netgroup.mn');`);
  await db.exec(
    `insert into public.units (id, code, name_mn, name_en) values ('77777777-7777-7777-7777-777777777777','OTHERUNIT','Өөр нэгж','Other Unit');`
  );
  await db.exec(
    `update public.users set unit_id = '77777777-7777-7777-7777-777777777777', role = 'unit_admin' where id = '66666666-6666-6666-6666-666666666666';`
  );
}

async function phase2Checks() {
  console.log("\nPhase 2 — Framework & Rules");

  // The unit_admin registers a framework document — as themselves, under
  // RLS, proving framework_documents_write actually permits this.
  await asUser("11111111-1111-1111-1111-111111111111");
  await db.query(`
    insert into public.framework_documents (id, unit_id, register_code, title, version, kind, source_text)
    values (
      '44444444-4444-4444-4444-444444444444',
      '22222222-2222-2222-2222-222222222222',
      'DOC-0035', 'IPPDD Policy Standard Procedure Set', 'v3.7', 'normative',
      'Section 6.3: Standalone artifacts not linked to a core document and not entered in its catalogue are prohibited.'
    );
  `);

  let dupRejected = false;
  try {
    await db.query(`
      insert into public.framework_documents (unit_id, register_code, title, version, kind)
      values ('22222222-2222-2222-2222-222222222222','DOC-0035','Duplicate','v3.7','normative');
    `);
  } catch (e) {
    dupRejected = e.code === "23505"; // unique_violation
  }
  check(
    "re-registering the same unit+register_code+version is rejected (Stage 2 version pin integrity)",
    dupRejected
  );

  // A DIFFERENT unit's admin must not be able to register a framework
  // document into unit 2222... — real proof of framework_documents_write's
  // unit-scoping, not just of the select side.
  await asUser("66666666-6666-6666-6666-666666666666");
  let crossUnitWriteRejected = false;
  try {
    await db.query(`
      insert into public.framework_documents (unit_id, register_code, title, version, kind)
      values ('22222222-2222-2222-2222-222222222222','DOC-HACK','x','v1','normative');
    `);
  } catch (e) {
    crossUnitWriteRejected = true;
  }
  check(
    "a different unit's admin cannot register a framework document into another unit",
    crossUnitWriteRejected
  );

  await asUser("11111111-1111-1111-1111-111111111111");
  await db.query(`
    insert into public.rule_sets (id, framework_document_id, status)
    values ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'draft');
  `);
  await db.query(`
    insert into public.rules (rule_set_id, code, citation, type, statement_mn, weight, blocking)
    values
      ('55555555-5555-5555-5555-555555555555', 'R1', '§6.3', 'R-LINK', 'Баримт эх сурвалж баримттай холбогдсон байх ёстой.', 20, true),
      ('55555555-5555-5555-5555-555555555555', 'R2', '§4.2', 'R-CODE', 'Дугаарлалт зөв форматтай байх ёстой.', 10, false);
  `);

  const asUnitAdmin = await db.query(`select public.can_review_rules() as can_review;`);
  check("'unit_admin' can review rules", asUnitAdmin.rows[0]?.can_review === true);

  await asSuperuser();
  await db.exec(`update public.users set role = 'author' where id = '11111111-1111-1111-1111-111111111111';`);
  await asUser("11111111-1111-1111-1111-111111111111");
  const asAuthor = await db.query(`select public.can_review_rules() as can_review;`);
  check("plain 'author' role is excluded from can_review_rules()", asAuthor.rows[0]?.can_review === false);
  await asSuperuser();
  await db.exec(`update public.users set role = 'unit_admin' where id = '11111111-1111-1111-1111-111111111111';`);

  await asUser("11111111-1111-1111-1111-111111111111");
  const ownUnitRules = await db.query(`select code from public.rules order by code;`);
  check(
    "the unit_admin sees both rules in their own unit's rule set",
    ownUnitRules.rows.length === 2 && ownUnitRules.rows.map((row) => row.code).join(",") === "R1,R2"
  );

  // The real cross-unit isolation proof, now genuinely under RLS.
  await asUser("66666666-6666-6666-6666-666666666666");
  const otherUnitFrameworks = await db.query(`select id from public.framework_documents;`);
  const otherUnitRuleSets = await db.query(`select id from public.rule_sets;`);
  const otherUnitRules = await db.query(`select id from public.rules;`);
  check(
    "a different unit's admin sees zero framework_documents/rule_sets/rules rows",
    otherUnitFrameworks.rows.length === 0 &&
      otherUnitRuleSets.rows.length === 0 &&
      otherUnitRules.rows.length === 0
  );

  await asSuperuser();
}

try {
  await applyAllMigrations();
  await phase1Checks();
  await phase2Checks();
} catch (e) {
  console.error("\nMigration verification FAILED:", e.message);
  process.exit(1);
} finally {
  await db.close();
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll migrations applied and all checks passed against a real Postgres engine (RLS enforced as a non-owning role).");
