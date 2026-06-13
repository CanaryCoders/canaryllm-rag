import type { Chunk, RagDocument } from "./types";

export interface ChunkOptions {
  /** Target size per chunk, in tokens. Default 512. */
  chunkSize?: number;
  /** Overlap between consecutive chunks, in tokens. Default 64. */
  chunkOverlap?: number;
  /** Recursive split order, coarse → fine. */
  separators?: string[];
  /**
   * Token counter. Default is a ~4-chars-per-token heuristic. Pass a real
   * tokenizer (e.g. tiktoken / the model's own) for exact sizing that matches
   * what the gateway bills.
   */
  countTokens?: (text: string) => number;
}

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/** Cheap, dependency-free token estimate: ~4 characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface ResolvedOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
  countTokens: (text: string) => number;
}

function resolve(opts: ChunkOptions): ResolvedOptions {
  const chunkSize = opts.chunkSize ?? 512;
  const chunkOverlap = opts.chunkOverlap ?? 64;
  if (chunkOverlap >= chunkSize) {
    throw new Error(`chunkOverlap (${chunkOverlap}) must be smaller than chunkSize (${chunkSize})`);
  }
  return {
    chunkSize,
    chunkOverlap,
    separators: opts.separators ?? DEFAULT_SEPARATORS,
    countTokens: opts.countTokens ?? estimateTokens,
  };
}

/** Join the buffered splits back with their separator and trim trailing whitespace. */
function joinSplits(splits: string[], separator: string): string {
  return splits.join(separator).trim();
}

/**
 * Pack small splits into chunks up to `chunkSize`, carrying `chunkOverlap`
 * tokens from the tail of each chunk into the next. Mirrors LangChain's
 * RecursiveCharacterTextSplitter._mergeSplits.
 */
function mergeSplits(splits: string[], separator: string, o: ResolvedOptions): string[] {
  const sepLen = o.countTokens(separator);
  const chunks: string[] = [];
  let current: string[] = [];
  let total = 0;

  for (const part of splits) {
    const len = o.countTokens(part);
    if (total + len + (current.length > 0 ? sepLen : 0) > o.chunkSize && current.length > 0) {
      const merged = joinSplits(current, separator);
      if (merged) chunks.push(merged);
      // Drop from the front until we're back under the overlap budget (and the
      // incoming part fits), keeping a tail for context continuity.
      while (
        current.length > 0 &&
        (total > o.chunkOverlap ||
          (total + len + (current.length > 0 ? sepLen : 0) > o.chunkSize && total > 0))
      ) {
        total -= o.countTokens(current[0]!) + (current.length > 1 ? sepLen : 0);
        current.shift();
      }
    }
    current.push(part);
    total += len + (current.length > 1 ? sepLen : 0);
  }
  const last = joinSplits(current, separator);
  if (last) chunks.push(last);
  return chunks;
}

function splitText(text: string, separators: string[], o: ResolvedOptions): string[] {
  const out: string[] = [];

  // Pick the coarsest separator that occurs in the text.
  let separator = separators[separators.length - 1] ?? "";
  let rest: string[] = [];
  for (let i = 0; i < separators.length; i++) {
    const s = separators[i]!;
    if (s === "") {
      separator = s;
      break;
    }
    if (text.includes(s)) {
      separator = s;
      rest = separators.slice(i + 1);
      break;
    }
  }

  const splits = separator === "" ? text.split("") : text.split(separator);
  let good: string[] = [];

  for (const s of splits) {
    if (o.countTokens(s) < o.chunkSize) {
      good.push(s);
    } else {
      if (good.length) {
        out.push(...mergeSplits(good, separator, o));
        good = [];
      }
      if (rest.length === 0) {
        out.push(s);
      } else {
        out.push(...splitText(s, rest, o));
      }
    }
  }
  if (good.length) out.push(...mergeSplits(good, separator, o));
  return out;
}

/** Split a raw string into overlapping, token-bounded pieces. */
export function splitTextIntoChunks(text: string, options: ChunkOptions = {}): string[] {
  const o = resolve(options);
  return splitText(text, o.separators, o).filter((c) => c.trim().length > 0);
}

/** Chunk a document, carrying its metadata onto every chunk. */
export function chunkDocument(doc: RagDocument, options: ChunkOptions = {}): Chunk[] {
  const pieces = splitTextIntoChunks(doc.text, options);
  return pieces.map((text, index) => ({
    id: `${doc.id}#${index}`,
    documentId: doc.id,
    index,
    text,
    metadata: { ...(doc.metadata ?? {}) },
  }));
}
