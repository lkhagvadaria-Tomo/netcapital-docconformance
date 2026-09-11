import type { AppUser } from "@/types/database.types";

// Manual user selection for local development without a live Supabase
// project (spec §2: "prototype may allow manual user selection behind a
// flag"). NEVER wired to real data — RLS is bypassed entirely in this mode
// since there's no real Postgres session. Only used when
// VITE_AUTH_MODE=mock or no Supabase project is configured at all.
//
// unit_id values match supabase/seed.sql (IPPDD / RISK) so the Admin screen
// looks consistent whichever mode you're in.
export const MOCK_USERS: AppUser[] = [
  {
    id: "mock-1",
    email: "b.gantsetseg@netgroup.mn",
    name: "Б.Ганцэцэг",
    unit_id: "IPPDD",
    role: "unit_admin",
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-2",
    email: "n.temuulen@netgroup.mn",
    name: "Н.Тэмүүлэн",
    unit_id: "RISK",
    role: "author",
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-3",
    email: "m.erdene@netgroup.mn",
    name: "О.Мөнх-Эрдэнэ",
    unit_id: "IPPDD",
    role: "enterprise_governance",
    created_at: new Date().toISOString(),
  },
];
