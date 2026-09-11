import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Node-only (fs access) — imported by tests and by the Edge Function's own
// Node-compatible build step, never by browser code. The browser side only
// ever calls `supabase.functions.invoke("extract-rules", {...})`; it never
// needs the prompt text itself.
const here = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(here, "../../../prompts");

/** Read one versioned prompt file's raw markdown (template placeholders and all). */
export function loadPromptTemplate(version: string): string {
  return readFileSync(path.join(PROMPTS_DIR, `${version}.md`), "utf8");
}
