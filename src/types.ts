/** A source document before chunking. */
export interface RagDocument {
  /** Stable id for the document (e.g. file path, mail UID, URL). */
  id: string;
  /** Full plain text. */
  text: string;
  /** Arbitrary metadata copied onto every chunk (source, title, mtime, tags…). */
  metadata?: Record<string, unknown>;
}

/** A chunk of a document, ready to embed and store. */
export interface Chunk {
  /** `${documentId}#${index}` by default. */
  id: string;
  documentId: string;
  /** 0-based position of this chunk within its document. */
  index: number;
  text: string;
  metadata: Record<string, unknown>;
}

/** A chunk with its embedding vector attached. */
export interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

/** A retrieval hit: a stored chunk plus its similarity score. */
export interface RetrievedChunk {
  id: string;
  documentId: string;
  text: string;
  metadata: Record<string, unknown>;
  /** Cosine similarity in [-1, 1] (1 = identical), as reported by the store. */
  score: number;
}
