// Phase 1 acceptance test (master spec §11):
//   "Two users in different units cannot see each other's data."
//
// This is a REAL integration test against a live Supabase project — it
// provisions two units and two auth users with the service-role key, signs
// in as each with the anon key, and asserts what each session's `users`
// query actually returns under RLS. It is NOT a mock: if it passes, the
// policies in supabase/migrations/0001_foundation.sql are proven, not just
// read.
//
// Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in the
// environment (see .env.example). No such project exists in the sandbox
// this repo was scaffolded in — see README "Known environment limitations".
// Run this for real with:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run tests/phase1-rls.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasLiveProject = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const RUN_ID = Math.random().toString(36).slice(2, 8);
const UNIT_A_CODE = `TESTA_${RUN_ID}`;
const UNIT_B_CODE = `TESTB_${RUN_ID}`;
const USER_A_EMAIL = `phase1-test-a-${RUN_ID}@netgroup.mn`;
const USER_B_EMAIL = `phase1-test-b-${RUN_ID}@netgroup.mn`;
const PASSWORD = `Test-${RUN_ID}-!Aa1`;

describe.skipIf(!hasLiveProject)(
  "Phase 1 — RLS isolation across units (golden acceptance test)",
  () => {
    const admin = hasLiveProject
      ? createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null!;

    let unitAId: string;
    let unitBId: string;
    let userAId: string;
    let userBId: string;

    beforeAll(async () => {
      const { data: unitA, error: unitAErr } = await admin
        .from("units")
        .insert({ code: UNIT_A_CODE, name_mn: "Тест нэгж А", name_en: "Test Unit A" })
        .select()
        .single();
      if (unitAErr) throw unitAErr;
      unitAId = unitA.id;

      const { data: unitB, error: unitBErr } = await admin
        .from("units")
        .insert({ code: UNIT_B_CODE, name_mn: "Тест нэгж Б", name_en: "Test Unit B" })
        .select()
        .single();
      if (unitBErr) throw unitBErr;
      unitBId = unitB.id;

      const { data: authA, error: authAErr } = await admin.auth.admin.createUser({
        email: USER_A_EMAIL,
        password: PASSWORD,
        email_confirm: true,
      });
      if (authAErr) throw authAErr;
      userAId = authA.user.id;

      const { data: authB, error: authBErr } = await admin.auth.admin.createUser({
        email: USER_B_EMAIL,
        password: PASSWORD,
        email_confirm: true,
      });
      if (authBErr) throw authBErr;
      userBId = authB.user.id;

      // The on_auth_user_created trigger already dropped both into
      // UNASSIGNED — move them into the two test units for real.
      const { error: moveAErr } = await admin
        .from("users")
        .update({ unit_id: unitAId, role: "author" })
        .eq("id", userAId);
      if (moveAErr) throw moveAErr;

      const { error: moveBErr } = await admin
        .from("users")
        .update({ unit_id: unitBId, role: "author" })
        .eq("id", userBId);
      if (moveBErr) throw moveBErr;
    });

    afterAll(async () => {
      if (!hasLiveProject) return;
      await admin.auth.admin.deleteUser(userAId).catch(() => {});
      await admin.auth.admin.deleteUser(userBId).catch(() => {});
      await admin.from("units").delete().eq("id", unitAId);
      await admin.from("units").delete().eq("id", unitBId);
    });

    it("user A sees only Unit A's users, never Unit B's", async () => {
      const clientA = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
      const { error: signInErr } = await clientA.auth.signInWithPassword({
        email: USER_A_EMAIL,
        password: PASSWORD,
      });
      expect(signInErr).toBeNull();

      const { data, error } = await clientA.from("users").select("*");
      expect(error).toBeNull();
      expect(data).toBeTruthy();

      const ids = (data ?? []).map((u) => u.id);
      expect(ids).toContain(userAId);
      expect(ids).not.toContain(userBId);
      expect((data ?? []).every((u) => u.unit_id === unitAId)).toBe(true);
    });

    it("user B sees only Unit B's users, never Unit A's", async () => {
      const clientB = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
      const { error: signInErr } = await clientB.auth.signInWithPassword({
        email: USER_B_EMAIL,
        password: PASSWORD,
      });
      expect(signInErr).toBeNull();

      const { data, error } = await clientB.from("users").select("*");
      expect(error).toBeNull();
      expect(data).toBeTruthy();

      const ids = (data ?? []).map((u) => u.id);
      expect(ids).toContain(userBId);
      expect(ids).not.toContain(userAId);
      expect((data ?? []).every((u) => u.unit_id === unitBId)).toBe(true);
    });

    it("an anonymous (never signed in) client sees no user rows", async () => {
      const anon = createClient<Database>(SUPABASE_URL!, ANON_KEY!);
      const { data, error } = await anon.from("users").select("*");
      // RLS requires auth.uid() is not null for units, and every users
      // policy branch requires a matching row — an anonymous caller should
      // get an empty set, not an error and not everyone else's data.
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  }
);

if (!hasLiveProject) {
  // eslint-disable-next-line no-console
  console.warn(
    "[phase1-rls.test.ts] SKIPPED — no live Supabase project configured " +
      "(SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY). " +
      "This is expected in the sandbox this repo was scaffolded in; run " +
      "against a real project before treating Phase 1 as verified. " +
      "See README 'Known environment limitations'."
  );
}
