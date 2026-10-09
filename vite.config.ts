import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";

export default defineConfig(({ mode }) => ({
  resolve: {
    // Use Preact's native hook; the CommonJS React shim bypasses aliases in tests.
    alias: [
      { find: /^use-sync-external-store\/shim(?:\/index\.js)?$/, replacement: "preact/compat" },
    ],
  },
  plugins: [preact(), ...(mode === "analyze" ? [analyzer()] : [])],
  worker: { format: "es" },
}));
