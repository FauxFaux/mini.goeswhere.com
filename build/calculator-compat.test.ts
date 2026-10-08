import { fileURLToPath } from "node:url";
import { build } from "vite";
import { expect, it } from "vitest";
import { calculatorCompat } from "./calculator-compat.ts";

it("evaluates arithmetic and unary functions in the production bundle", async () => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [calculatorCompat()],
    build: {
      write: false,
      lib: {
        entry: fileURLToPath(new URL("../src/tools/calculator/evaluate.ts", import.meta.url)),
        formats: ["es"],
      },
    },
  });
  const output = Array.isArray(result) ? result[0] : result;
  if (!("output" in output)) throw new Error("Expected an in-memory build");
  const chunk = output.output.find((item) => item.type === "chunk");
  if (!chunk || chunk.type !== "chunk") throw new Error("Expected a JavaScript chunk");
  // Import emitted JS so these assertions exercise strict bundled code, rather
  // than Node's unbundled, sloppy-mode CommonJS package used by unit tests.
  const bundled = await import(
    `data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`
  );
  for (const [expression, value] of [
    ["(12 + 8) * 3", 60],
    ["sqrt(144) + max(3, 7)", 19],
    ["sin(pi / 2)", 1],
    ["ln(e)", 1],
    ["-5 + 2", -3],
    ["2 ^ 10", 1024],
  ]) {
    expect(bundled.evaluateExpression(expression)).toEqual({ kind: "ok", value });
  }
  expect(bundled.evaluateExpression("2 +").kind).toBe("error");
});
