export type { RagDocument, Chunk, EmbeddedChunk, RetrievedChunk } from "./types";

export {
  splitTextIntoChunks,
  chunkDocument,
  estimateTokens,
  type ChunkOptions,
} from "./chunk";

export { htmlToText, markdownToText, extractText } from "./parse";

export { canaryEmbedder, type Embedder, type CanaryEmbedderOptions } from "./embed";

export { ingestDocuments, type IngestOptions, type IngestResult } from "./ingest";

export {
  retrieve,
  buildContext,
  buildRagMessages,
  type RetrieveOptions,
  type RagMessage,
} from "./retrieve";

export type { VectorStore, SearchOptions } from "./store/types";
