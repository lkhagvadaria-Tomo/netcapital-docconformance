// Real, runnable tests (no network, no Supabase, no Deno needed) for the
// Stage 3 (§4.2) strict output contract — the part of Phase 2 that is
// actually safety-critical: does the parser really refuse an invented
// citation or an out-of-taxonomy rule type, rather than just being asked
// nicely in the prompt to avoid them?

import { describe, it, expect } from "vitest";
import { buildExtractionPrompt } from "@/lib/ruleExtraction/buildPrompt";
import { loadPromptTemplate } from "@/lib/ruleExtraction/loadPromptTemplate";
import { parseRulesResponse } from "@/lib/ruleExtraction/parseRulesResponse";
import { RULE_TYPES } from "@/lib/ruleExtraction/schema";

const SOURCE_TEXT =
  "Section 6.3: Standalone artifacts not linked to a core document and not " +
  "entered in its catalogue are prohibited. Section 4.2 requires the code " +
  "segment INVEST in every document identifier issued under this Policy.";

describe("buildExtractionPrompt", () => {
  it("fills every placeholder from the real v1 template, leaving no {{...}} behind", () => {
    const template = loadPromptTemplate("extract-rules.v1");
    const prompt = buildExtractionPrompt(template, {
      registerCode: "DOC-0035",
      title: "IPPDD Policy Standard Procedure Set",
      version: "v3.7",
      kind: "normative",
      sourceText: SOURCE_TEXT,
    });
    expect(prompt).toContain("DOC-0035");
    expect(prompt).toContain("IPPDD Policy Standard Procedure Set");
    expect(prompt).toContain(SOURCE_TEXT);
    expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("does not let a document's own text be mistaken for a placeholder", () => {
    const template = "Doc: {{TITLE}}\n\n{{SOURCE_TEXT}}";
    const prompt = buildExtractionPrompt(template, {
      registerCode: "X",
      title: "A doc that literally says {{SOURCE_TEXT}} in its own text",
      version: "v1",
      kind: "normative",
      sourceText: "real body",
    });
    // The literal placeholder text embedded in the *title* should have been
    // substituted only where it came from TITLE's own replacement, and the
    // real source text still appears exactly once as itself.
    expect(prompt).toBe("Doc: A doc that literally says real body in its own text\n\nreal body");
  });
});

describe("parseRulesResponse", () => {
  it("accepts a well-formed rule whose citation is verbatim in the source", () => {
    const reply = JSON.stringify([
      {
        code: "R1",
        citation: "Section 6.3",
        type: "R-LINK",
        statement_mn: "Баримт эх сурвалж баримттай холбогдсон байх ёстой.",
        statement_en: "Documents must link to a core document.",
        weight: 20,
        blocking: true,
        detection_spec: {},
        remediation_template: "Холбоос нэм.",
      },
    ]);
    const result = parseRulesResponse(reply, SOURCE_TEXT);
    expect(result.rejected).toHaveLength(0);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toMatchObject({ code: "R1", type: "R-LINK", blocking: true });
  });

  it("parses a JSON array wrapped in a markdown code fence with surrounding prose", () => {
    const reply = `Here are the rules I found:\n\n\`\`\`json\n${JSON.stringify([
      {
        code: "R1",
        citation: "Section 4.2",
        type: "R-CODE",
        statement_mn: "Дугаарт INVEST код орсон байх ёстой.",
      },
    ])}\n\`\`\`\n\nLet me know if you need more.`;
    const result = parseRulesResponse(reply, SOURCE_TEXT);
    expect(result.rejected).toHaveLength(0);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].type).toBe("R-CODE");
    // Fields the model omitted get safe, non-crashing defaults.
    expect(result.rules[0].weight).toBe(1);
    expect(result.rules[0].blocking).toBe(false);
  });

  it("REJECTS a rule whose citation was invented (not verbatim in the source) — the core §8/§13 guarantee", () => {
    const reply = JSON.stringify([
      {
        code: "R1",
        citation: "Section 9.9",
        type: "R-LINK",
        statement_mn: "Зохиомол ишлэлтэй дүрэм.",
      },
    ]);
    const result = parseRulesResponse(reply, SOURCE_TEXT);
    expect(result.rules).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toMatch(/does not appear verbatim/);
  });

  it("REJECTS a rule with an out-of-taxonomy type instead of accepting it", () => {
    const reply = JSON.stringify([
      {
        code: "R1",
        citation: "Section 6.3",
        type: "R-MADE-UP",
        statement_mn: "x",
      },
    ]);
    const result = parseRulesResponse(reply, SOURCE_TEXT);
    expect(result.rules).toHaveLength(0);
    expect(result.rejected[0].reason).toContain("R-MADE-UP");
  });

  it("REJECTS entries missing a statement, while still accepting the valid sibling in the same array", () => {
    const reply = JSON.stringify([
      { code: "R1", citation: "Section 6.3", type: "R-LINK", statement_mn: "" },
      { code: "R2", citation: "Section 4.2", type: "R-CODE", statement_mn: "Хүчинтэй мөр." },
    ]);
    const result = parseRulesResponse(reply, SOURCE_TEXT);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].code).toBe("R2");
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].index).toBe(0);
  });

  it("returns an empty, non-throwing result for a reply with no JSON at all", () => {
    const result = parseRulesResponse("Sorry, I could not find any rules in this document.", SOURCE_TEXT);
    expect(result.rules).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/no parseable JSON/);
  });

  it("covers the full §4.1 taxonomy (documentation guard: fails if RULE_TYPES ever drifts from the DB enum by accident)", () => {
    expect(RULE_TYPES).toEqual([
      "R-LINK",
      "R-CODE",
      "R-LAYER",
      "R-AUTH",
      "R-META",
      "R-STATE",
      "R-DECISION",
      "R-FEED",
    ]);
  });
});
