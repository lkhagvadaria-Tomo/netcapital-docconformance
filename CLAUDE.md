# Netcapital DocConformance — Claude-ийн ажлын гарын авлага

Энэ файл нь энэ репод ажиллах Claude session бүрийн санах ой. **Ажил эхлэхийн
өмнө бүхэлд нь унш.** Бүрэн эх сурвалж нь анхны master prompt (§0–§14) —
хэрэв энэ файлтай зөрчилдвөл, эсвэл дэлгэрэнгүй хэрэгтэй бол master prompt-ыг
хэрэглэгчээс лавлаж ав; энэ файл зөвхөн товч тэмдэглэл.

## Юу вэ

Нэткапитал Санхүүгийн Группын **баримт бичгийн засаглалын нийцлийн шалгалтын
платформ**: OKR-ийн KR тус бүрийн Related Document-оос дүрэм задлан авч,
үйлдвэрлэсэн баримтуудыг **контентын түвшинд** (файлын нэр биш) шалгаж,
0–100 онооны gap-ыг **IN_DOCUMENT / DECISION_GATED / EXTERNAL_SYSTEM / MIXED**
гэсэн fix class-аар ялгаж, гурван гаралт (Findings Register, Improvement
Task Prompts, Roadmap to 100) гаргана.

## Одоогийн төлөв — Build Phase (§11)

- ✅ **Phase 1 — Foundation.** Auth (Google OAuth + mock), units, users,
  roles, RLS. Sidebar shell, theme toggle, Mongolian i18n scaffold.
- ✅ **Phase 2 — Framework & Rules.** framework_documents (хувилбар pin),
  AI дүрэм задлалт (Edge Function, §4.1 strict output contract), Rule Set
  review дэлгэц (§7.3, accept/edit/reject + approve gate).
- ⏳ Phase 3-с хойш: **хэрэглэгчийн зөвшөөрөлгүйгээр бүү эхэл.** Master
  spec §14: "Дараагийн фаз руу миний зөвшөөрлөөр орно."

## Хатуу дүрэм (§13, бүгдийг мөрд)

1. OKR-ийн ишлээгүй хувилбарын эсрэг хэзээ ч бүү шалга (Stage 2 pin).
2. Ишлэлгүй/quote-гүй finding бүү гарга.
3. Fix class-уудыг (`IN_DOCUMENT`/`DECISION_GATED`/`EXTERNAL_SYSTEM`/`MIXED`)
   хэзээ ч бүү нэгтгэ.
4. Оноог горимын шошгогүйгээр (Зарласан/Нотлогдсон) бүү харуул.
5. AI-д ямар ч зүйлийг batlуулж болохгүй — Rule Set батлах, finding
   шийдэгдсэн гэж тэмдэглэх, батламж мөрөнд гарын үсэг зурах бүгд хүний үйлдэл.
6. Нэг нэгжийн framework-ийг хатуу кодлохгүй — §4.1 taxonomy-г өргөтгө.
7. Хамааралгүй dimension-ийг 0 гэж бүү тоол — хасаж дахин масштаблана (§5.1).
8. Conformance доголдлыг зохиогчийн буруу мэт бүү танилцуул (§13.8).

## Техникийн санамж — энэ орчны хязгаарлалт

- **Docker байхгүй** (client bin бий, daemon алга) → `supabase start`,
  local Postgres/Supabase stack энэ орчинд ажиллахгүй. **Үүний оронд:
  `npm run db:verify`** (`scripts/verify-migrations.mjs`, PGlite ашиглана)
  — migration бүрийг жинхэнэ Postgres engine дээр ажиллуулж, RLS
  function/trigger/constraint-ыг бодитоор шалгадаг. **Шинэ migration бичих
  бүрдээ энэ script-т тухайн migration-ий санамсаргүй зан үйлийг шалгах
  assertion нэмээд ажиллуул** — зөвхөн SQL зөв бичигдсэн эсэхийг биш,
  зорилтот зан үйлийг нь баталгаажуулна.
- **Жинхэнэ Supabase project, Google OAuth credential алга** энэ орчинд.
  Иймд:
  - `VITE_AUTH_MODE=mock` (эсвэл Supabase тохируулаагүй үед автоматаар) —
    `src/lib/auth/mockAuth.ts`-ийн жагсаалтаас хэрэглэгч гараар сонгоно.
    **Энэ нь зөвхөн локал хөгжүүлэлтэд зориулагдсан — production-д хэзээ ч
    идэвхжихгүй байх ёстой** (§10: "Auth: Google OAuth, `@netgroup.mn`
    hosted-domain restriction; prototype may allow manual user selection
    behind a flag").
  - `tests/phase1-rls.test.ts` бол **жинхэнэ** интеграцийн тест (мок биш) —
    гэхдээ жинхэнэ Supabase project байхгүй тул энэ орчинд ердөө **skip**
    хийгдэнэ (`describe.skipIf`), false-pass өгдөггүй. README-г үз.
- **`Database` типийн файлд `interface` биш `type` alias ашигла.**
  `src/types/database.types.ts`-д тайлбарласан: `Partial<Omit<InterfaceType,
  "x">>`-г Update баганад ашиглахад энэ orчны supabase-js (2.116) + TS
  (5.9) хослолд бүх Tables map нь `never`-т буурч, `.insert()`/`.update()`
  бүгд харилцаагүй "excess property" алдаа өгдөг болсон нь баталгаажсан
  (debug хийсэн). Мөн Database interface-д `__InternalSupabase:
  {PostgrestVersion: "12"}` шаардлагатай.
- Google Fonts (IBM Plex Sans/Mono) энэ sandbox-д offline тул ачаалахгүй,
  зөв fallback stack бий (system-ui) — production deploy дээр ажиллана.

## Дизайны токен (§9)

`src/theme/tokens.css` — 3 блокийн загвар (bare `:root` → `@media
(prefers-color-scheme: dark)` guard → `[data-theme="dark"]`). Severity
(good/warn/crit) өнгө нь `dataviz` skill-ийн validator-аар шалгагдсан
(colour-blind safe, ΔE ≥ 15 normal-vision, ≥ 8 CVD). Шинэ өнгө нэмэхдээ
дахин validate хий.

## Data model (§6)

- `supabase/migrations/0001_foundation.sql`: `units`, `users` (public
  schema, `auth.users`-тэй 1:1), `user_role` enum, RLS policies,
  `UNASSIGNED` holding unit + `on_auth_user_created` trigger.
- `supabase/migrations/0002_framework_rules.sql`: `framework_documents`
  (unit+register_code+version unique — Stage 2 version pin),
  `rule_sets`/`rules` (§4.1 taxonomy enum, review_status gate), `ai_runs`
  (every AI call logged, §10 non-negotiable). RLS mirrors Phase 1's
  unit-scoping, extended via join to `framework_documents.unit_id`.

## AI rule extraction (Phase 2, §4.2 Stage 3 / §8)

`src/lib/ruleExtraction/{schema,buildPrompt,parseRulesResponse}.ts` is the
safety-critical, **pure, unit-tested** core (`tests/phase2-rule-extraction.test.ts`,
real and passing — no network needed): it enforces that every extracted
rule's `citation` appears **verbatim** in the source text and that `type`
is one of the exact 8 taxonomy codes, rejecting (never silently dropping
into a best-effort guess) anything else. `supabase/functions/extract-rules/`
is the thin Deno Edge Function wrapper around that core — it calls the
Anthropic Messages API server-side (never from the browser, never with the
key exposed) and writes a `draft` rule_set + rules + an `ai_runs` row.
**Not executed in this sandbox** (no Deno runtime, no live project, no
`ANTHROPIC_API_KEY` here) — deploy and exercise it for real before trusting
it (`supabase functions deploy extract-rules`, `supabase secrets set
ANTHROPIC_API_KEY=...`). It authorizes the caller (via their own JWT
against `can_review_rules()` + RLS) *before* switching to the service-role
key to do the privileged write — don't remove that two-client split when
touching this file.

`src/lib/ruleSets.ts` (`isRuleSetUsableInAudit`, `isRuleSetReadyToApprove`)
is Phase 2's other acceptance-test half — Phase 3's audit runner MUST call
`isRuleSetUsableInAudit`, never inline a `status === 'approved'` check of
its own.

## Дараагийн алхам (хэрэглэгчийн зөвшөөрлөөр)

Phase 3 — Documents & deterministic rules: Produced Document ingest +
control-block extraction, R-CODE/R-META/R-STATE аль нь ч AI биш, код
хэлбэрээр. *Acceptance test*: өөрчлөгдөөгүй баримт дээр аудитыг дахин
ажиллуулахад findings нь byte-identical байх ёстой (§11 Phase 3) —
эргэн харахад: `ai_runs`-ийн `input_hash` нь давхардсан дуудлагыг олж
чадах ёстой тул det. rules-ийн determinism-ийг шалгах цөөн unit test-ийг
эхлээд бич.
