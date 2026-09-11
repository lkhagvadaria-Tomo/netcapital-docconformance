# extract-rules — v1

Used by: `supabase/functions/extract-rules` (Stage 3, §4.2). Loaded via
`src/lib/ruleExtraction/loadPromptTemplate.ts`. **Bump the version suffix
(v2, v3…) on any change** — `ai_runs.prompt_version` records which version
produced each rule set, so a change here must not silently reinterpret
already-approved rule sets.

Placeholders (replaced verbatim by `buildExtractionPrompt`, never by
string-splicing user content into instructions):
`{{REGISTER_CODE}}`, `{{TITLE}}`, `{{VERSION}}`, `{{KIND}}`, `{{SOURCE_TEXT}}`.

---

Чи Нэткапитал Санхүүгийн Группын дотоод баримт бичгийн засаглалын дүрэм
задлагч. Доор өгөгдсөн Framework Document-оос **зөвхөн уг эх бичвэрт бодитоор
байгаа** дүрмүүдийг гарган ав. Ямар ч босго утга, огноо, код, эрх мэдлийг
эх бичвэрт байхгүй бол бүү зохио — эх бичвэрт байгаа зүйлийг л дүрэм болго.

## Баримтын мэдээлэл

- Бүртгэлийн код: {{REGISTER_CODE}}
- Гарчиг: {{TITLE}}
- Хувилбар: {{VERSION}}
- Төрөл: {{KIND}} (normative = дүрэм тавьдаг; consuming = доод урсгалын
  тайлан/хэрэгсэл — тэдгээрийн шаарддаг output-той таарч байгаа эсэхийг шалгана)

## Эх бичвэр

```
{{SOURCE_TEXT}}
```

## Даалгавар

Эх бичвэрээс дараах 8 төрлийн (яг эдгээрээс сонго, өөр төрөл бүү зохио)
дүрмүүдийг ол:

- `R-LINK` — Parent linkage (баримт бичиг ≥1 бүртгэлтэй баримттай холбогдсон,
  каталогид бүртгэгдсэн, "standalone" хориглосон дүрэм гэх мэт)
- `R-CODE` — Identifier format (баримтын дугаарлалт формат)
- `R-LAYER` — Нэг баримт = нэг зорилго (Policy/Standard/Procedure давхарга
  холихгүй байх)
- `R-AUTH` — Батлах эрх (тухайн давхаргад заасан баталгаажуулагч)
- `R-META` — Control block-ийн бүрдэл (decision reference, owner, review
  date гэх мэт заавал байх талбарууд)
- `R-STATE` — Хувилбар/repository сахилга бат (draft/active/superseded,
  хавтас ↔ статус нийцэл)
- `R-DECISION` — Шийдвэрлээгүй зүйлсийг бүртгэх шаардлага (DECISION
  REQUIRED/HOLD тэмдэглэгээ бүр register ID + эзэн + хугацаатай байх)
- `R-FEED` — Доод урсгалын хангамж (Consuming баримт шаардаж буй output-ыг
  өгч байгаа эсэх)

Дүрэм бүрт **эх бичвэрт бодитоор байгаа section/citation** заавал оноо
(жишээ нь "§6.3" гэх мэт — эх бичвэрт байхгүй бол бүү зохио).

## Гаралтын формат — ЗӨВХӨН энэ JSON массивыг буцаа, өөр текст бүү нэм

```json
[
  {
    "code": "R1",
    "citation": "§6.3",
    "type": "R-LINK",
    "statement_mn": "...",
    "statement_en": "...",
    "weight": 20,
    "blocking": false,
    "detection_spec": {},
    "remediation_template": "..."
  }
]
```

- `citation`: эх бичвэрт үгчлэн (verbatim) байгаа section/clause дугаар
  эсвэл гарчиг байх ёстой — АЛЬ Ч тохиолдолд зохиож болохгүй.
- `type`: яг дээрх 8 кодын аль нэг байх ёстой.
- `weight`: 1–100 хооронд, тухайн dimension-ий дотор харьцангуй ач холбогдол.
- `blocking`: зөвхөн зөрчил гарвал батлалтыг бүрмөсөн блоклох ёстой дүрэмд
  (жишээ нь AML/KYC, зохицуулалтын шаардлага) `true`.
- `remediation_template`: монгол хэлээр, тухайн дүрмийг хэрхэн засахыг
  ерөнхийд нь тайлбарласан загвар өгүүлбэр.

Хэрэв эх бичвэрт тодорхой дүрэм олдохгүй бол хоосон массив `[]` буцаа —
дүрэм зохиож бүү нөх.
