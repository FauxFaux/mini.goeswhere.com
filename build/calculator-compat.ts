/**
 * advanced-calculator 1.4.2 names its tree evaluator `eval`. That is legal in
 * its sloppy CommonJS sources but forbidden in Vite 8's strict bundled modules.
 * Rename the private evaluator and declare the unary parser's stack operand.
 * Both were relying on sloppy CommonJS semantics. This also
 * runs in dependency prebundling, so dev and production use the same code.
 */
export function calculatorCompat() {
  return {
    name: "advanced-calculator-strict-mode",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!/\/advanced-calculator\/src\/Basic\/(?:index|shunting)\.js(?:\?|$)/.test(id)) return;
      return {
        code: code
          .replace(/\beval\b/g, "evaluateNode")
          .replace(/^(\s*)a = stack\.pop\(\);/m, "$1let a = stack.pop();"),
        map: null,
      };
    },
  };
}
