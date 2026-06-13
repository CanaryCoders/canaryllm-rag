import type { Embedder } from "./embed";
import type { VectorStore } from "./store/types";
import type { RetrievedChunk } from "./types";

export interface RetrieveOptions {
  embedder: Embedder;
  store: VectorStore;
  /** Number of chunks to return. Default 5. */
  topK?: number;
  /** Metadata equality filter passed to the store. */
  filter?: Record<string, unknown>;
}

/** Embed the query and return the most similar stored chunks. */
export async function retrieve(query: string, options: RetrieveOptions): Promise<RetrievedChunk[]> {
  const vectors = await options.embedder.embed([query]);
  const vec = vectors[0];
  if (!vec) return [];
  return options.store.search(vec, {
    topK: options.topK,
    ...(options.filter ? { filter: options.filter } : {}),
  });
}

/** Render retrieved chunks into a numbered context block for a prompt. */
export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks.map((c, i) => `[${i + 1}] (${c.documentId})\n${c.text}`).join("\n\n");
}

export interface RagMessage {
  role: "system" | "user";
  content: string;
}

const DEFAULT_PREAMBLE =
  "You are a helpful assistant. Answer the question using only the provided context. " +
  "If the context does not contain the answer, say so. Cite sources by their [n] marker.";

/**
 * Build chat messages for a grounded answer. Feed the result to
 * `client.chat.complete({ provider, model, messages })`.
 */
export function buildRagMessages(
  query: string,
  chunks: RetrievedChunk[],
  preamble: string = DEFAULT_PREAMBLE,
): RagMessage[] {
  return [
    { role: "system", content: `${preamble}\n\nContext:\n${buildContext(chunks)}` },
    { role: "user", content: query },
  ];
}
