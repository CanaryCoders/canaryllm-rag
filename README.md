# @canarycoders/canaryllm-rag

Bun-first RAG toolkit for [CanaryLLM](https://canaryllm.canarycoders.es). Parse, chunk, embed and retrieve over your own documents — **the documents, chunks, embeddings and vector index all stay on your infrastructure.** CanaryLLM only does the transient embedding and chat calls; it stores nothing.

It builds on the official SDK ([`@canarycoders/canaryllm`](https://github.com/CanaryCoders/canaryllm-sdk)) and adds the RAG layer: a recursive token chunker, text extraction, a pluggable vector store (pgvector adapter included), and ingest/retrieve orchestration.

## Why this shape

Embeddings derived from your documents are themselves personal data (text can be partially reconstructed from a vector). Keeping the vectors in *your* store — not ours — keeps you in control of access, retention and erasure, and means no document content is ever persisted by the gateway. The only thing that crosses the wire is chunk text, embedded transiently on local (LM Studio) inference with no third-country transfer.

## Install

```bash
bun add @canarycoders/canaryllm-rag @canarycoders/canaryllm
```

You also need a Postgres with the [`pgvector`](https://github.com/pgvector/pgvector) extension (or implement the `VectorStore` interface for another store), and an LM Studio embedding model loaded behind your CanaryLLM gateway (e.g. `nomic-embed-text-v1.5`).

## Quick start (pgvector)

```ts
import { Pool } from "pg";
import { CanaryLLM } from "@canarycoders/canaryllm";
import { canaryEmbedder, ingestDocuments, retrieve, buildRagMessages } from "@canarycoders/canaryllm-rag";
import { PgVectorStore } from "@canarycoders/canaryllm-rag/store/pgvector";

const client = new CanaryLLM({ apiKey: process.env.CANARYLLM_API_KEY });
const embedder = canaryEmbedder(client, { model: "nomic-embed-text-v1.5" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const store = new PgVectorStore(pool, { dimensions: 768 }); // match your model
await store.migrate(); // creates extension, table, HNSW cosine index

// 1. Ingest — chunk → embed → upsert (your store, your data)
await ingestDocuments(
  [
    { id: "handbook.md", text: handbookText, metadata: { source: "handbook.md" } },
    { id: "policy.md", text: policyText, metadata: { source: "policy.md" } },
  ],
  { embedder, store, chunk: { chunkSize: 512, chunkOverlap: 64 } },
);

// 2. Retrieve — embed the question, search your store
const hits = await retrieve("How many vacation days do I get?", { embedder, store, topK: 5 });

// 3. Answer — grounded completion via the gateway
const messages = buildRagMessages("How many vacation days do I get?", hits);
const answer = await client.chat.complete({ provider: "lmstudio", model: "qwen3-32b", messages });
console.log(answer.content);
```

## Parsing

The toolkit ingests plain text (`RagDocument.text`). For HTML and Markdown, use the built-in extractors:

```ts
import { htmlToText, markdownToText, extractText } from "@canarycoders/canaryllm-rag";

const text = htmlToText(rawHtml);
const md = markdownToText(rawMarkdown);
const auto = extractText(content, "html"); // dispatch by extension/mime hint
```

For **PDF/DOCX**, extract on your side (so the raw file never leaves your box) and pass the resulting string in:

```ts
import pdf from "pdf-parse";        // your dependency
import mammoth from "mammoth";       // your dependency

const { text: pdfText } = await pdf(await Bun.file("contract.pdf").arrayBuffer());
const { value: docxText } = await mammoth.extractRawText({ buffer: await Bun.file("brief.docx").arrayBuffer() });

await ingestDocuments(
  [{ id: "contract.pdf", text: pdfText, metadata: { source: "contract.pdf" } }],
  { embedder, store },
);
```

## Chunking

`chunkDocument` / `splitTextIntoChunks` use a recursive splitter (paragraph → line → sentence → word → char) that packs pieces up to `chunkSize` tokens with `chunkOverlap` tokens of carry-over. The default token count is a ~4-chars-per-token estimate; pass a real tokenizer for exact sizing:

```ts
import { splitTextIntoChunks } from "@canarycoders/canaryllm-rag";

const chunks = splitTextIntoChunks(text, {
  chunkSize: 512,
  chunkOverlap: 64,
  countTokens: (t) => myTokenizer.encode(t).length,
});
```

## Custom stores

Implement `VectorStore` to back the toolkit with sqlite-vec, Qdrant, Weaviate, etc.:

```ts
import type { VectorStore } from "@canarycoders/canaryllm-rag";
```

`PgVectorStore` takes any node-postgres-shaped client (`{ query(sql, params) }`), so the `pg` driver and your credentials stay your dependency — they never touch this package.

## Local development

This package depends on `@canarycoders/canaryllm`. Until both are published to npm, link the SDK for local work:

```bash
cd ../canaryllm-sdk && bun link
cd ../canaryllm-rag && bun link @canarycoders/canaryllm && bun install
```

```bash
bun run typecheck
bun test
bun run build
```

## Roadmap

Shipped (v0.1): embeddings client, recursive chunker, HTML/Markdown extraction, pgvector store, ingest/retrieve, grounded-answer message builder.

Planned: sqlite-vec adapter, IMAP and Microsoft Graph email connectors, a watch/poll ingestion sidecar, reranking, hybrid (BM25 + vector) search, and retrieval-quality evaluation tooling.

## License

MIT
