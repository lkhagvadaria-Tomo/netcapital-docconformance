// Hand-written Phase 1 slice of the schema (§6). Once a real Supabase
// project exists, replace with `supabase gen types typescript` output —
// keep this file's shape compatible so the rest of the app doesn't churn.

export type UserRole =
  | "author"
  | "reviewer"
  | "approver"
  | "unit_admin"
  | "enterprise_governance";

// NOTE: these are `type` aliases, not `interface`s, on purpose. Feeding an
// `interface` into `Partial<Omit<...>>` below (the Update column type) makes
// this supabase-js version's generic constraint chain collapse the whole
// Tables map to `never` — every `.insert()`/`.update()` call across every
// table type-checks as `never`/`never[]` with a confusing "excess property"
// error that has nothing to do with the real mistake. Plain `type` aliases
// don't hit that path. If you add a table type here, keep it a `type`.
export type Unit = {
  id: string;
  code: string;
  name_mn: string;
  name_en: string;
  parent_unit_id: string | null;
  created_at: string;
};

export type AppUser = {
  id: string;
  email: string;
  name: string;
  unit_id: string;
  role: UserRole;
  created_at: string;
};

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      units: {
        Row: Unit;
        Insert: {
          id?: string;
          code: string;
          name_mn: string;
          name_en: string;
          parent_unit_id?: string | null;
        };
        Update: Partial<Omit<Unit, "id">>;
        Relationships: [];
      };
      users: {
        Row: AppUser;
        Insert: {
          id: string;
          email: string;
          name: string;
          unit_id: string;
          role?: UserRole;
        };
        Update: Partial<Omit<AppUser, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
