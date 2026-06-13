import { describe, expect, test } from "bun:test";
import { PgVectorStore, type Queryable } from "../../src/store/pgvector";

const noopDb: Queryable = { query: async () => ({ rows: [] }) };

describe("PgVectorStore constructor validation", () => {
  test("accepts a plain identifier and positive dimensions", () => {
    expect(() => new PgVectorStore(noopDb, { table: "rag_chunks", dimensions: 768 })).not.toThrow();
    expect(() => new PgVectorStore(noopDb, { dimensions: 384 })).not.toThrow();
  });

  test("rejects an unsafe table name", () => {
    expect(() => new PgVectorStore(noopDb, { table: "x; DROP TABLE users; --", dimensions: 768 })).toThrow(/unsafe table/i);
    expect(() => new PgVectorStore(noopDb, { table: "bad-name", dimensions: 768 })).toThrow(/unsafe table/i);
  });

  test("rejects non-positive or non-integer dimensions", () => {
    expect(() => new PgVectorStore(noopDb, { dimensions: 0 })).toThrow(/dimensions/i);
    expect(() => new PgVectorStore(noopDb, { dimensions: -1 })).toThrow(/dimensions/i);
    expect(() => new PgVectorStore(noopDb, { dimensions: 1.5 })).toThrow(/dimensions/i);
  });
});

describe("PgVectorStore search", () => {
  test("maps rows to RetrievedChunk and uses topK + cosine ordering", async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const db: Queryable = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return {
          rows: [
            { id: "d#0", document_id: "d", text: "hello", metadata: { a: 1 }, score: "0.92" },
          ],
        };
      },
    };
    const store = new PgVectorStore(db, { dimensions: 3 });
    const hits = await store.search([0.1, 0.2, 0.3], { topK: 7, filter: { a: 1 } });

    expect(hits[0]).toEqual({ id: "d#0", documentId: "d", text: "hello", metadata: { a: 1 }, score: 0.92 });
    expect(calls[0]!.sql).toContain("embedding <=> $1::vector");
    expect(calls[0]!.sql).toContain("metadata @> $2::jsonb");
    expect(calls[0]!.params).toEqual(["[0.1,0.2,0.3]", JSON.stringify({ a: 1 }), 7]);
  });
});
