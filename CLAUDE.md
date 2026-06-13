# canaryllm-rag

Bun-first RAG toolkit (`@canarycoders/canaryllm-rag`). Builds on the official SDK `@canarycoders/canaryllm`; adds chunking, text extraction, vector-store adapters, and ingest/retrieve. Zero runtime deps except the SDK. Node 18+ / Bun.

## Privacy contract (do not break)

Documents, chunks, embeddings and the vector index live in the **customer's** store. The toolkit only sends chunk text to the gateway to embed it transiently. Never add a path that persists customer content anywhere outside the customer-supplied `VectorStore`.

## Layout

- `src/chunk.ts` — recursive token-based splitter with overlap (pure, tested).
- `src/parse.ts` — HTML/Markdown → text (pure). PDF/DOCX are extracted on the customer side and passed in as text.
- `src/embed.ts` — `Embedder` interface + `canaryEmbedder(client)` adapter over `client.embeddings.create`.
- `src/store/` — `VectorStore` interface + `PgVectorStore` (takes an injected `pg`-shaped client; no hard `pg` dep).
- `src/ingest.ts`, `src/retrieve.ts` — orchestration + grounded-answer message builder.

## Sync

The SDK's `client.embeddings.create` shape is the contract. If the gateway's embeddings endpoint changes, update the SDK first, then this toolkit. Keep `dependencies["@canarycoders/canaryllm"]` at the matching semver.

## Commands

```bash
bun run typecheck
bun test
bun run build      # tsup → dist (ESM + CJS + .d.ts), 2 entries: . and ./store/pgvector
```

Local dev needs the SDK linked (`bun link @canarycoders/canaryllm`) until both are on npm.
