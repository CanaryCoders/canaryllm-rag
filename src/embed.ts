import type { CanaryLLM } from "@canarycoders/canaryllm";

/** Turns text into vectors. Decouples ingest/retrieve from any specific backend. */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export interface CanaryEmbedderOptions {
  /** Embedding model id, e.g. `nomic-embed-text-v1.5`. */
  model?: string;
  /** Output dimensionality for models that support truncation (Matryoshka). */
  dimensions?: number;
  /** Max inputs per gateway call (endpoint caps at 2048). Default 256. */
  batchSize?: number;
}

/**
 * Adapt a CanaryLLM client into an {@link Embedder}. Calls the gateway's local
 * (LM Studio) embeddings endpoint in batches; the gateway processes text
 * transiently and stores nothing.
 */
export function canaryEmbedder(client: CanaryLLM, options: CanaryEmbedderOptions = {}): Embedder {
  const batchSize = options.batchSize ?? 256;
  return {
    async embed(texts: string[]): Promise<number[][]> {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const res = await client.embeddings.create({
          provider: "lmstudio",
          input: batch,
          ...(options.model ? { model: options.model } : {}),
          ...(options.dimensions ? { dimensions: options.dimensions } : {}),
        });
        out.push(...res.embeddings);
      }
      return out;
    },
  };
}
