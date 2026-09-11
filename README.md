# Netcapital DocConformance

Баримт бичгийн засаглалын нийцлийн шалгалтын платформ — OKR-ийн Key Result
бүрийн Related Document-д заасан framework-тэй, үйлдвэрлэсэн баримтууд
**контентын түвшинд** нийцэж байгаа эсэхийг автоматаар шалгаж, засах ажлыг
`IN_DOCUMENT` / `DECISION_GATED` / `EXTERNAL_SYSTEM` / `MIXED` гэж ангилна.

Бүтэн бүтээгдэхүүний спек (домэйны логик, scoring загвар, 8 Build Phase,
golden acceptance case) — master prompt-д бий; `CLAUDE.md` нь зөвхөн товч
хураангуй.

## Одоогийн төлөв

**Phase 1 — Foundation** дуусаж, шалгагдсан: Auth (Google OAuth + локал
mock горим), Units/Users/Roles, Row-Level Security, sidebar shell, theme
toggle (цайвар/бараан/систем), Монгол i18n scaffold.

Phase 2-с хойшхийг зөвхөн хэрэглэгчийн шууд зөвшөөрлөөр эхэлнэ.

## Түргэн эхлэх

```bash
npm install
cp .env.example .env.local   # хоосон орхивол автоматаар "mock" горимд орно
npm run dev
```

`.env.local`-д `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` хоосон бол апп
автоматаар **Хөгжүүлэлтийн горим (mock)**-д орж, `src/lib/auth/mockAuth.ts`-ийн
3 жишээ хэрэглэгчээс сонгоно (нэг нь `unit_admin`, нэг нь энгийн `author`,
нэг нь `enterprise_governance`) — Admin дэлгэц дээрх эрхийн ялгааг шууд
харах боломжтой. Энэ горим **зөвхөн локал хөгжүүлэлтэд**; production-д
хэзээ ч идэвхжихгүй байх ёстой.

## Жинхэнэ Supabase project холбох

1. https://supabase.com дээр шинэ project үүсгэ.
2. SQL Editor-т `supabase/migrations/0001_foundation.sql`-ийг ажиллуул
   (дараа нь хүсвэл `supabase/seed.sql`).
3. Authentication → Providers → Google идэвхжүүл, `hd=netgroup.mn`
   хязгаарлалт тохируулна (client id/secret Google Cloud Console-оос).
4. Project Settings → API-аас URL, anon key-г `.env.local`-д хуул.
5. `npm run dev` — одоо жинхэнэ Google OAuth (`@netgroup.mn`) идэвхтэй.

## Тест

```bash
npm test
```

`tests/phase1-rls.test.ts` бол Phase 1-ийн acceptance test-ийг ("хоёр өөр
нэгжийн хэрэглэгч бие биенийхээ дата харахгүй") **жинхэнэ Supabase project**
дээр шалгадаг интеграцийн тест — 2 unit, 2 auth хэрэглэгч бодитоор үүсгэж,
хоёуланг нь нэвтрүүлж, RLS-ийн ард юу харагдахыг баталгаажуулна. Env vars
байхгүй энэ орчинд **skip** хийгдэнэ (мок биш — зүгээр ажиллуулах боломжгүй
учир):

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm test
```

## Мэдэгдэж буй орчны хязгаарлалт (энэ session)

Энэ репо анх скаффолдсон sandbox орчинд:

- **Docker daemon алга** (client бий, `dockerd` алга) → Supabase CLI-ийн
  локал стек (`supabase start`) энд ажиллахгүй. Бодит хөгжүүлэлтийн машин
  дээр Docker-той бол ажиллана.
- **Жинхэнэ Supabase project / Google OAuth credential алга** → дээрх mock
  горим болон skip хийгдсэн RLS тестээр орлуулсан. Эдгээрийг үнэн хэрэгтээ
  батлахын тулд жинхэнэ project холбож, `npm test`-ийг дахин ажиллуулах
  шаардлагатай.
- Google Fonts (IBM Plex Sans/Mono) offline sandbox-д ачаалагдаагүй ч зөв
  fallback stack ажиллаж байгааг харсан; production/интернэттэй орчинд
  хэвийн ачаална.

Эдгээрийг код дотор дуурайхгүй, харин дээрх байдлаар үнэнчээр тусгасан
болно (mock горим тод шошготой, тест skip хийгдэхдээ дуугардаг).

## Стек

React + TypeScript + Vite + Tailwind · Supabase (Postgres/Auth/Storage,
RLS) · Claude API (Phase 2-с хойш, `/prompts`-д хувилбарлагдана).
