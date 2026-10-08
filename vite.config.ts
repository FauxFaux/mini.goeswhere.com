import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { calculatorCompat } from "./build/calculator-compat.ts";

export default defineConfig({
  resolve: {
    // Use Preact's native hook; the CommonJS React shim bypasses aliases in tests.
    alias: [
      { find: /^use-sync-external-store\/shim(?:\/index\.js)?$/, replacement: "preact/compat" },
    ],
  },
  plugins: [calculatorCompat(), preact()],
  optimizeDeps: {
    rolldownOptions: { plugins: [calculatorCompat()] },
  },
});
