import { chunkDocument, type ChunkOptions } from "./chunk";
import type { Embedder } from "./embed";
import type { VectorStore } from "./store/types";
import type { EmbeddedChunk, RagDocument } from "./types";

export interface IngestOptions {
  embedder: Embedder;
  store: VectorStore;
  /** Chunking configuration (size, overlap, separators, tokenizer). */
  chunk?: ChunkOptions;
}

export interface IngestResult {
  documents: number;
  chunks: number;
}

/**
 * Parse-free ingestion: chunk → embed (via the gateway) → upsert into your store.
 * Pass already-extracted text as {@link RagDocument}s (use the parse helpers or
 * your own pdf/docx extractor first). Documents and vectors live only in your
 * store; the gateway sees chunk text transiently to embed it.
 */
export async function ingestDocuments(
  docs: RagDocument[],
  options: IngestOptions,
): Promise<IngestResult> {
  const chunks = docs.flatMap((d) => chunkDocument(d, options.chunk));
  if (chunks.length === 0) return { documents: docs.length, chunks: 0 };

  const vectors = await options.embedder.embed(chunks.map((c) => c.text));
  if (vectors.length !== chunks.length) {
    throw new Error(
      `embedder returned ${vectors.length} vectors for ${chunks.length} chunks`,
    );
  }

  const embedded: EmbeddedChunk[] = chunks.map((c, i) => ({ ...c, embedding: vectors[i]! }));
  await options.store.upsert(embedded);
  return { documents: docs.length, chunks: embedded.length };
}
