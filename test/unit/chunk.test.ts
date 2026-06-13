import { describe, expect, test } from "bun:test";
import {
  chunkDocument,
  estimateTokens,
  splitTextIntoChunks,
} from "../../src/chunk";

// Use a word-count tokenizer for predictable assertions.
const wordTokens = (t: string) => (t.trim() === "" ? 0 : t.trim().split(/\s+/).length);

describe("splitTextIntoChunks", () => {
  test("keeps short text as a single chunk", () => {
    const chunks = splitTextIntoChunks("hello world", { chunkSize: 100, countTokens: wordTokens });
    expect(chunks).toEqual(["hello world"]);
  });

  test("splits long text into bounded chunks", () => {
    const text = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
    const chunks = splitTextIntoChunks(text, {
      chunkSize: 10,
      chunkOverlap: 2,
      countTokens: wordTokens,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(wordTokens(c)).toBeLessThanOrEqual(10);
    }
  });

  test("produces overlapping chunks", () => {
    const overlap = 3;
    const text = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
    const chunks = splitTextIntoChunks(text, {
      chunkSize: 10,
      chunkOverlap: overlap,
      countTokens: wordTokens,
    });
    // the last `overlap` tokens of chunk[0] reappear at the head of chunk[1]
    const tail = chunks[0]!.split(/\s+/).slice(-overlap);
    expect(chunks[1]!.split(/\s+/).slice(0, overlap)).toEqual(tail);
  });

  test("prefers paragraph then sentence boundaries", () => {
    const text = "First sentence. Second sentence.\n\nNew paragraph here.";
    const chunks = splitTextIntoChunks(text, {
      chunkSize: 4,
      chunkOverlap: 0,
      countTokens: wordTokens,
    });
    expect(chunks.join(" ")).toContain("paragraph");
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });

  test("rejects overlap >= size", () => {
    expect(() => splitTextIntoChunks("x", { chunkSize: 4, chunkOverlap: 4 })).toThrow();
  });
});

describe("chunkDocument", () => {
  test("carries metadata and assigns stable ids", () => {
    const text = Array.from({ length: 40 }, (_, i) => `t${i}`).join(" ");
    const chunks = chunkDocument(
      { id: "doc-1", text, metadata: { source: "a.md" } },
      { chunkSize: 10, chunkOverlap: 2, countTokens: wordTokens },
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.id).toBe("doc-1#0");
    expect(chunks[1]!.id).toBe("doc-1#1");
    expect(chunks[0]!.documentId).toBe("doc-1");
    expect(chunks[0]!.metadata.source).toBe("a.md");
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });
});

describe("estimateTokens", () => {
  test("~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});
