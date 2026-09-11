import { describe, it, expect } from "vitest";
import { isRuleSetUsableInAudit, usableRuleSets, isRuleSetReadyToApprove } from "@/lib/ruleSets";

describe("isRuleSetUsableInAudit / usableRuleSets", () => {
  it("excludes a draft rule set — the Phase 2 acceptance test's other half", () => {
    expect(isRuleSetUsableInAudit({ status: "draft" })).toBe(false);
  });
  it("excludes a retired rule set", () => {
    expect(isRuleSetUsableInAudit({ status: "retired" })).toBe(false);
  });
  it("includes only an approved rule set", () => {
    expect(isRuleSetUsableInAudit({ status: "approved" })).toBe(true);
  });
  it("filters a mixed list down to only the approved ones", () => {
    const sets = [{ status: "draft" as const }, { status: "approved" as const }, { status: "retired" as const }];
    expect(usableRuleSets(sets)).toEqual([{ status: "approved" }]);
  });
});

describe("isRuleSetReadyToApprove", () => {
  it("is false with zero rules (nothing to approve)", () => {
    expect(isRuleSetReadyToApprove([])).toBe(false);
  });
  it("is false while any rule is still pending review", () => {
    expect(
      isRuleSetReadyToApprove([{ review_status: "accepted" }, { review_status: "pending" }])
    ).toBe(false);
  });
  it("is true once every rule has been accepted, edited, or rejected", () => {
    expect(
      isRuleSetReadyToApprove([
        { review_status: "accepted" },
        { review_status: "edited" },
        { review_status: "rejected" },
      ])
    ).toBe(true);
  });
});
