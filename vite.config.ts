import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import preload from "vite-plugin-preload";

export default defineConfig(({ mode }) => ({
  resolve: {
    // Use Preact's native hook; the CommonJS React shim bypasses aliases in tests.
    alias: [
      { find: /^use-sync-external-store\/shim(?:\/index\.js)?$/, replacement: "preact/compat" },
    ],
  },
  plugins: [preact(), preload(), ...(mode === "analyze" ? [analyzer()] : [])],
  worker: { format: "es" },
}));
