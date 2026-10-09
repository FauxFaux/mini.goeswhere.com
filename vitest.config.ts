import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default defineConfig((env) =>
  mergeConfig(
    viteConfig(env),
    defineConfig({
      test: {
        // Run the browser-only WASM loader in an isolated worker-like VM.
        execArgv: ["--experimental-vm-modules"],
        // Inlining applies the preset's React → Preact aliases to wouter's imports.
        server: { deps: { inline: ["wouter"] } },
        fsModuleCache: true,
      },
    }),
  ),
);
