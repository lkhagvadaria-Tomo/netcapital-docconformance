// Supabase Edge Function (Deno runtime) — Stage 3 of the pipeline (§4.2).
//
// NOT EXECUTED OR DEPLOYED in the sandbox this repo was scaffolded in: no
// Deno runtime, no live Supabase project, no ANTHROPIC_API_KEY were
// available there (see README "Known environment limitations"). It has
// been reviewed carefully but not run — deploy it to a real project
// (`supabase functions deploy extract-rules`, with `ANTHROPIC_API_KEY` set
// via `supabase secrets set`) and exercise it for real before relying on it.
//
// What IS verified for real, without Deno: the two pure modules this
// function leans on for the safety-critical part — buildExtractionPrompt
// and parseRulesResponse (src/lib/ruleExtraction/) — have real, passing
// unit tests (tests/phase2-rule-extraction.test.ts). Deno can import plain
// .ts files with no Node-specific APIs directly, which is why those two
// (and schema.ts) are written with zero `node:*` imports.
//
// Request: POST { framework_document_id: string }
// Auth: the caller's own JWT (forwarded automatically by
//   supabase.functions.invoke() from the browser) — this function does its
//   OWN authorization check against that JWT before touching anything with
//   elevated privilege; it does not just trust the caller.
//
// AI boundary (§8, non-negotiable): this function creates a `draft` rule
// set. It NEVER sets status to 'approved' — only a human, through the
// Rule Set review screen (§7.3), can do that.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { buildExtractionPrompt } from "../../../src/lib/ruleExtraction/buildPrompt.ts";
import { parseRulesResponse } from "../../../src/lib/ruleExtraction/parseRulesResponse.ts";
import { CORS_HEADERS } from "../_shared/cors.ts";

const PROMPT_VERSION = "extract-rules.v1";
const MODEL = "claude-sonnet-4-5";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { framework_document_id: frameworkDocumentId } = await req.json();
    if (typeof frameworkDocumentId !== "string" || !frameworkDocumentId) {
      return jsonResponse({ error: "framework_document_id is required" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY is not configured for this project" }, 500);
    }

    // Step 1 — authorize AS THE CALLER, under RLS. If they can't review
    // rules, or the document isn't in a unit they belong to, this SELECT
    // returns nothing and we reject — we never fall back to the service
    // role to "helpfully" find the document anyway.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: canReview } = await callerClient.rpc("can_review_rules");
    if (canReview !== true) {
      return jsonResponse({ error: "not authorized to extract/review rules" }, 403);
    }
    const { data: doc, error: docErr } = await callerClient
      .from("framework_documents")
      .select("id, unit_id, register_code, title, version, kind, source_text")
      .eq("id", frameworkDocumentId)
      .maybeSingle();
    if (docErr || !doc) {
      return jsonResponse({ error: "framework document not found or not accessible" }, 404);
    }
    if (!doc.source_text || doc.source_text.trim() === "") {
      return jsonResponse({ error: "this framework document has no source_text to extract from yet" }, 400);
    }

    // Step 2 — do the privileged work (calling Claude, writing rule_sets /
    // rules / ai_runs) with the service role, now that we've proven the
    // caller was allowed to ask for it.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const template = await Deno.readTextFile(
      new URL("../../../prompts/extract-rules.v1.md", import.meta.url)
    );
    const prompt = buildExtractionPrompt(template, {
      registerCode: doc.register_code,
      title: doc.title,
      version: doc.version,
      kind: doc.kind,
      sourceText: doc.source_text,
    });

    const inputHash = await sha256Hex(prompt);
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      await admin.from("ai_runs").insert({
        unit_id: doc.unit_id,
        framework_document_id: doc.id,
        prompt_version: PROMPT_VERSION,
        model: MODEL,
        input_hash: inputHash,
        output: `ERROR ${anthropicRes.status}: ${errText}`,
      });
      return jsonResponse({ error: "the model call failed", detail: errText }, 502);
    }

    const anthropicJson = await anthropicRes.json();
    const rawText: string = (anthropicJson.content ?? [])
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { text: string }) => block.text)
      .join("\n");

    await admin.from("ai_runs").insert({
      unit_id: doc.unit_id,
      framework_document_id: doc.id,
      prompt_version: PROMPT_VERSION,
      model: MODEL,
      input_hash: inputHash,
      output: rawText,
      input_tokens: anthropicJson.usage?.input_tokens ?? null,
      output_tokens: anthropicJson.usage?.output_tokens ?? null,
    });

    // Step 3 — the strict output contract (§8/§13): reject invented
    // citations and out-of-taxonomy types HERE, in code, not by trusting
    // the model's own adherence to the prompt.
    const { rules, rejected } = parseRulesResponse(rawText, doc.source_text);

    if (rules.length === 0) {
      return jsonResponse(
        {
          error: "no valid rules extracted — needs human review (§8 'unverifiable' path)",
          rejected,
        },
        200
      );
    }

    const { data: ruleSet, error: ruleSetErr } = await admin
      .from("rule_sets")
      .insert({ framework_document_id: doc.id, status: "draft" })
      .select()
      .single();
    if (ruleSetErr) throw ruleSetErr;

    const { error: rulesErr } = await admin.from("rules").insert(
      rules.map((r) => ({
        rule_set_id: ruleSet.id,
        code: r.code,
        citation: r.citation,
        type: r.type,
        statement_mn: r.statement_mn,
        statement_en: r.statement_en,
        weight: r.weight,
        blocking: r.blocking,
        detection_spec: r.detection_spec,
        remediation_template: r.remediation_template,
        review_status: "pending",
      }))
    );
    if (rulesErr) throw rulesErr;

    return jsonResponse({ rule_set_id: ruleSet.id, accepted: rules.length, rejected }, 200);
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "internal error", detail: String(e) }, 500);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
