-- Dev/staging seed — NOT run in production. Idempotent.
-- Gives Admin (§7.8) something to look at, and names the two units the
-- Phase 1 acceptance test ("two users in different units cannot see each
-- other's data") exercises. Matches the master spec's golden-case unit.

insert into public.units (code, name_mn, name_en) values
  ('IPPDD', 'Хөрөнгө оруулалтын бүтээгдэхүүн, процесс хөгжүүлэлтийн газар', 'Investment Product & Process Development'),
  ('RISK',  'Эрсдэлийн удирдлагын газар',                                    'Risk Management')
on conflict (code) do nothing;

-- public.users rows are NOT seeded here: a row requires a matching
-- auth.users id, which only exists once someone actually signs in (or a
-- test harness provisions one via the Supabase Admin API — see
-- tests/phase1-rls.test.ts). Seeding a fake auth.users row directly is
-- possible in a self-hosted/local stack but brittle against hosted
-- Supabase, so this repo does not do it: use the test script or sign in
-- for real, then use Админ to move the profile out of UNASSIGNED.
