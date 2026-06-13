import type { EmbeddedChunk, RetrievedChunk } from "../types";
import type { SearchOptions, VectorStore } from "./types";

/**
 * Anything shaped like a node-postgres client/pool. We don't depend on `pg`
 * itself — you pass your own `Pool`, so the driver stays your dependency and
 * your connection/credentials never touch this package.
 */
export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export interface PgVectorOptions {
  /** Table name. Default `rag_chunks`. */
  table?: string;
  /** Embedding dimensionality. Must match your model (e.g. 768 for nomic). */
  dimensions: number;
}

/** Format a JS number[] as a pgvector literal: `[0.1,0.2,...]`. */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export class PgVectorStore implements VectorStore {
  private readonly db: Queryable;
  private readonly table: string;
  private readonly dimensions: number;

  constructor(db: Queryable, options: PgVectorOptions) {
    this.db = db;
    this.table = options.table ?? "rag_chunks";
    this.dimensions = options.dimensions;
    // The table name is interpolated into DDL/DML (it can't be a bound
    // parameter), so reject anything that isn't a plain SQL identifier.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(this.table)) {
      throw new Error(`PgVectorStore: unsafe table name "${this.table}"`);
    }
    if (!Number.isInteger(this.dimensions) || this.dimensions < 1) {
      throw new Error(`PgVectorStore: dimensions must be a positive integer, got ${this.dimensions}`);
    }
  }

  /** Create the extension, table and an HNSW cosine index if they don't exist. */
  async migrate(): Promise<void> {
    await this.db.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this.db.query(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
         id          text PRIMARY KEY,
         document_id text NOT NULL,
         chunk_index integer NOT NULL,
         text        text NOT NULL,
         metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
         embedding   vector(${this.dimensions}) NOT NULL
       )`,
    );
    await this.db.query(
      `CREATE INDEX IF NOT EXISTS ${this.table}_embedding_idx
         ON ${this.table} USING hnsw (embedding vector_cosine_ops)`,
    );
    await this.db.query(
      `CREATE INDEX IF NOT EXISTS ${this.table}_document_id_idx ON ${this.table} (document_id)`,
    );
  }

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    for (const c of chunks) {
      await this.db.query(
        `INSERT INTO ${this.table} (id, document_id, chunk_index, text, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector)
         ON CONFLICT (id) DO UPDATE SET
           document_id = EXCLUDED.document_id,
           chunk_index = EXCLUDED.chunk_index,
           text        = EXCLUDED.text,
           metadata    = EXCLUDED.metadata,
           embedding   = EXCLUDED.embedding`,
        [c.id, c.documentId, c.index, c.text, JSON.stringify(c.metadata), toVectorLiteral(c.embedding)],
      );
    }
  }

  async search(queryVector: number[], options: SearchOptions = {}): Promise<RetrievedChunk[]> {
    const topK = options.topK ?? 5;
    const params: unknown[] = [toVectorLiteral(queryVector)];
    let where = "";
    if (options.filter && Object.keys(options.filter).length > 0) {
      params.push(JSON.stringify(options.filter));
      where = `WHERE metadata @> $${params.length}::jsonb`;
    }
    params.push(topK);
    // `<=>` is cosine distance in [0, 2]; `1 - distance` is cosine similarity in [-1, 1].
    const { rows } = await this.db.query(
      `SELECT id, document_id, text, metadata,
              1 - (embedding <=> $1::vector) AS score
         FROM ${this.table}
         ${where}
         ORDER BY embedding <=> $1::vector
         LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      text: r.text,
      metadata: r.metadata ?? {},
      score: Number(r.score),
    }));
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.db.query(`DELETE FROM ${this.table} WHERE document_id = $1`, [documentId]);
  }
}
