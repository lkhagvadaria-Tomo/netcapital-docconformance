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
- ⏳ Phase 2-с хойш: **хэрэглэгчийн зөвшөөрөлгүйгээр бүү эхэл.** Master
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
  local Postgres/Supabase stack энэ орчинд ажиллахгүй.
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

## Data model (§6, Phase 1 slice)

`supabase/migrations/0001_foundation.sql`: `units`, `users` (public schema,
`auth.users`-тэй 1:1), `user_role` enum, RLS policies, `UNASSIGNED` holding
unit + `on_auth_user_created` trigger (шинэ Google sign-in автоматаар
UNASSIGNED-д унана — Админ-аас жинхэнэ нэгжид шилжүүлнэ).

## Дараагийн алхам (хэрэглэгчийн зөвшөөрлөөр)

Phase 2 — Framework & Rules: framework document бүртгэл (хувилбар pin),
AI-аар дүрэм задлах, Rule Set батлах дэлгэц (§7.3). *Acceptance test*:
жишээ framework баримтаас дүрэм задлаад, reviewer тус бүрийг
accept/edit/reject хийж чадах ёстой; батлагдаагүй Rule Set аудитад
сонгогдохгүй байх ёстой.
