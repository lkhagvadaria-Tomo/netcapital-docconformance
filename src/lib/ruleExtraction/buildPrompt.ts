import type { FrameworkDocumentInput } from "./schema";

/**
 * Fill the versioned template (prompts/extract-rules.v1.md, passed in as
 * `template` — see loadPromptTemplate.ts for where that file gets read from
 * on each runtime) with one framework document's data. Pure and
 * synchronous on purpose: no file I/O here, so this is trivially testable
 * without touching disk or a network.
 *
 * Placeholders are replaced verbatim (not interpolated as template
 * literals) so a `{{...}}`-shaped substring inside a real document's own
 * text can never be mistaken for a directive to the model.
 */
export function buildExtractionPrompt(
  template: string,
  doc: FrameworkDocumentInput
): string {
  return template
    .replaceAll("{{REGISTER_CODE}}", doc.registerCode)
    .replaceAll("{{TITLE}}", doc.title)
    .replaceAll("{{VERSION}}", doc.version)
    .replaceAll("{{KIND}}", doc.kind)
    .replaceAll("{{SOURCE_TEXT}}", doc.sourceText);
}
