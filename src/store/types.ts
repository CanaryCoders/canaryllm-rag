import type { EmbeddedChunk, RetrievedChunk } from "../types";

export interface SearchOptions {
  /** Number of nearest neighbours to return. Default 5. */
  topK?: number;
  /** Optional metadata equality filter (ANDed). */
  filter?: Record<string, unknown>;
}

/**
 * Minimal vector store contract. The toolkit ships a pgvector adapter; implement
 * this interface to plug in sqlite-vec, Qdrant, Weaviate, etc. The store lives on
 * the customer's infrastructure — CanaryLLM never sees it.
 */
export interface VectorStore {
  /** Insert or replace chunks (by `id`). */
  upsert(chunks: EmbeddedChunk[]): Promise<void>;
  /** Return the `topK` chunks most similar to `queryVector`. */
  search(queryVector: number[], options?: SearchOptions): Promise<RetrievedChunk[]>;
  /** Remove every chunk belonging to a document. */
  deleteDocument(documentId: string): Promise<void>;
}
