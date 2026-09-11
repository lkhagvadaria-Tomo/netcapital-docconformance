import type { Rule, RuleSet } from "@/types/database.types";

/**
 * The other half of the Phase 2 acceptance test ("an unapproved set cannot
 * be selected in an audit"). There is no audits table yet (Phase 3), so
 * this is the reusable gate Phase 3's audit runner will call — write it
 * once, test it now, never reimplement the check inline where it's used.
 */
export function isRuleSetUsableInAudit(ruleSet: Pick<RuleSet, "status">): boolean {
  return ruleSet.status === "approved";
}

export function usableRuleSets<T extends Pick<RuleSet, "status">>(ruleSets: T[]): T[] {
  return ruleSets.filter(isRuleSetUsableInAudit);
}

/** A rule set can only be approved once every rule under it has been reviewed (§7.3). */
export function isRuleSetReadyToApprove(rules: Pick<Rule, "review_status">[]): boolean {
  return rules.length > 0 && rules.every((r) => r.review_status !== "pending");
}
