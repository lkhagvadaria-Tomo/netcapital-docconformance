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

export type FrameworkKind = "normative" | "consuming";
export type RuleSetStatus = "draft" | "approved" | "retired";
export type RuleType =
  | "R-LINK"
  | "R-CODE"
  | "R-LAYER"
  | "R-AUTH"
  | "R-META"
  | "R-STATE"
  | "R-DECISION"
  | "R-FEED";
export type RuleReviewStatus = "pending" | "accepted" | "edited" | "rejected";

export type FrameworkDocument = {
  id: string;
  unit_id: string;
  register_code: string;
  title: string;
  version: string;
  kind: FrameworkKind;
  source_ref: string | null;
  source_text: string | null;
  superseded_by_id: string | null;
  created_by: string | null;
  pinned_at: string;
  created_at: string;
};

export type RuleSet = {
  id: string;
  framework_document_id: string;
  status: RuleSetStatus;
  extracted_by: string | null;
  extracted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

export type Rule = {
  id: string;
  rule_set_id: string;
  code: string;
  citation: string;
  type: RuleType;
  statement_mn: string;
  statement_en: string | null;
  weight: number;
  detection_spec: Record<string, unknown>;
  remediation_template: string | null;
  blocking: boolean;
  review_status: RuleReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
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
      framework_documents: {
        Row: FrameworkDocument;
        Insert: {
          id?: string;
          unit_id: string;
          register_code: string;
          title: string;
          version: string;
          kind?: FrameworkKind;
          source_ref?: string | null;
          source_text?: string | null;
          superseded_by_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Omit<FrameworkDocument, "id">>;
        Relationships: [];
      };
      rule_sets: {
        Row: RuleSet;
        Insert: {
          id?: string;
          framework_document_id: string;
          status?: RuleSetStatus;
          extracted_by?: string | null;
          extracted_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: Partial<Omit<RuleSet, "id">>;
        Relationships: [];
      };
      rules: {
        Row: Rule;
        Insert: {
          id?: string;
          rule_set_id: string;
          code: string;
          citation: string;
          type: RuleType;
          statement_mn: string;
          statement_en?: string | null;
          weight?: number;
          detection_spec?: Record<string, unknown>;
          remediation_template?: string | null;
          blocking?: boolean;
          review_status?: RuleReviewStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: Partial<Omit<Rule, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_review_rules: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      framework_kind: FrameworkKind;
      rule_set_status: RuleSetStatus;
      rule_type: RuleType;
      rule_review_status: RuleReviewStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
