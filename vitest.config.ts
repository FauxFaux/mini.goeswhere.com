import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Inlining applies the preset's React → Preact aliases to wouter's imports.
      server: { deps: { inline: ["wouter"] } },
    },
  }),
);
