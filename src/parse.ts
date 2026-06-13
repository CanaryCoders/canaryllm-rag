/**
 * Lightweight, dependency-free text extraction for the formats that don't need
 * a binary parser. For PDF/DOCX, extract the text on your side (e.g. with
 * `pdf-parse` / `mammoth`) and pass the resulting string straight into
 * `ingestDocuments` — see the README recipe. Keeping parsing on your side means
 * the raw file never leaves your infrastructure; only chunk text is embedded.
 */

const BLOCK_TAGS = /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|header|footer)\b[^>]*>/gi;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Strip HTML to readable plain text: drop script/style, turn blocks into newlines. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(BLOCK_TAGS, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Strip the common Markdown syntax to plain prose while keeping the text. */
export function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, "").replace(/```$/, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/(\*\*|__)(.*?)\1/gs, "$2")
    .replace(/(\*|_)(.*?)\1/gs, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Dispatch text extraction by a format hint (extension or mime fragment). */
export function extractText(content: string, format?: string): string {
  const f = (format ?? "").toLowerCase();
  if (f.includes("html") || f === "htm") return htmlToText(content);
  if (f.includes("markdown") || f === "md") return markdownToText(content);
  return content;
}
