// §4.1 taxonomy — exactly these eight, mirrored from the `rule_type` enum
// in supabase/migrations/0002_framework_rules.sql. Keep the two in sync;
// scripts/verify-migrations.mjs's Phase 2 checks exercise the DB side.
export const RULE_TYPES = [
  "R-LINK",
  "R-CODE",
  "R-LAYER",
  "R-AUTH",
  "R-META",
  "R-STATE",
  "R-DECISION",
  "R-FEED",
] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export interface FrameworkDocumentInput {
  registerCode: string;
  title: string;
  version: string;
  kind: "normative" | "consuming";
  sourceText: string;
}

/** One rule as extracted by Claude, before it has been reviewed (§7.3). */
export interface ExtractedRule {
  code: string;
  citation: string;
  type: RuleType;
  statement_mn: string;
  statement_en: string;
  weight: number;
  blocking: boolean;
  detection_spec: Record<string, unknown>;
  remediation_template: string;
}

export interface RejectedRule {
  index: number;
  raw: unknown;
  reason: string;
}

export interface ParseRulesResult {
  rules: ExtractedRule[];
  rejected: RejectedRule[];
}
