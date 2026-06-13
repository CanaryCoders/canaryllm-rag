import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/store/pgvector.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // The CanaryLLM SDK is a peer at runtime; never bundle it.
  external: ["@canarycoders/canaryllm"],
});
