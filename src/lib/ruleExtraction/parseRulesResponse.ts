import { RULE_TYPES, type ExtractedRule, type ParseRulesResult, type RuleType } from "./schema";

/**
 * The Stage 3 (§4.2) strict output contract, applied to a model's raw text
 * reply. This is where "never invent a citation... that is not in a source
 * document" (§8) is actually enforced in code, not just asked for in the
 * prompt: a rule whose `citation` doesn't appear verbatim in the source
 * text is REJECTED, never silently kept. Same for an out-of-taxonomy
 * `type` (§13.6: never special-case — extend RULE_TYPES instead of
 * accepting something else here).
 *
 * Never throws: a reply with no parseable JSON, or one where every rule
 * fails validation, comes back as `{rules: [], rejected: [...]}` — the
 * caller (the Edge Function) decides what a fully-empty result means
 * (probably: surface it for human review, per §8's "unverifiable" path).
 */
export function parseRulesResponse(rawText: string, sourceText: string): ParseRulesResult {
  const candidate = extractJsonArray(rawText);
  if (candidate === null) {
    return { rules: [], rejected: [{ index: -1, raw: rawText, reason: "no parseable JSON array found in reply" }] };
  }

  const rules: ExtractedRule[] = [];
  const rejected: ParseRulesResult["rejected"] = [];

  candidate.forEach((raw, index) => {
    const reason = validationFailureReason(raw, sourceText);
    if (reason) {
      rejected.push({ index, raw, reason });
      return;
    }
    const item = raw as Record<string, unknown>;
    rules.push({
      code: String(item.code),
      citation: String(item.citation),
      type: item.type as RuleType,
      statement_mn: String(item.statement_mn),
      statement_en: typeof item.statement_en === "string" ? item.statement_en : "",
      weight: typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : 1,
      blocking: item.blocking === true,
      detection_spec:
        item.detection_spec && typeof item.detection_spec === "object" && !Array.isArray(item.detection_spec)
          ? (item.detection_spec as Record<string, unknown>)
          : {},
      remediation_template: typeof item.remediation_template === "string" ? item.remediation_template : "",
    });
  });

  return { rules, rejected };
}

function validationFailureReason(raw: unknown, sourceText: string): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return "entry is not a JSON object";
  }
  const item = raw as Record<string, unknown>;

  if (typeof item.code !== "string" || item.code.trim() === "") {
    return "missing or empty 'code'";
  }
  if (typeof item.statement_mn !== "string" || item.statement_mn.trim() === "") {
    return "missing or empty 'statement_mn'";
  }
  if (typeof item.type !== "string" || !RULE_TYPES.includes(item.type as RuleType)) {
    return `'type' must be one of ${RULE_TYPES.join(", ")}, got ${JSON.stringify(item.type)}`;
  }
  if (typeof item.citation !== "string" || item.citation.trim() === "") {
    return "missing or empty 'citation'";
  }
  // The non-negotiable: a citation must be traceable to the actual source
  // text, not invented. Verbatim substring match — no fuzzy matching, so a
  // citation the model paraphrased away from the source's own wording is
  // correctly rejected too (tighten the prompt, don't loosen this check).
  if (!sourceText.includes(item.citation)) {
    return `citation ${JSON.stringify(item.citation)} does not appear verbatim in the source text`;
  }
  return null;
}

/**
 * Tolerant JSON-array extraction, matching the same read order the `sample`
 * capability documents for its own `.json()` contract: the whole reply as
 * JSON; else a fenced code block's body; else the substring from the first
 * `[` to the last `]`. Returns `null` (never throws) when nothing parses to
 * an array.
 */
function extractJsonArray(text: string): unknown[] | null {
  const attempts = [text, fencedBlockBody(text), bracketSlice(text)].filter(
    (s): s is string => typeof s === "string"
  );
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function fencedBlockBody(text: string): string | null {
  const match = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return match ? match[1] : null;
}

function bracketSlice(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
