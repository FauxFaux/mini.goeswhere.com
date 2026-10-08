/** Error reporting must also survive circular values, bigints, and broken getters. */
export function formatDiagnostic(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return (
      JSON.stringify(
        value,
        (_key, item: unknown) => {
          if (typeof item === "bigint") return `${item}n`;
          if (typeof item === "object" && item !== null) {
            if (seen.has(item)) return "[Circular]";
            seen.add(item);
          }
          return item;
        },
        2,
      ) ?? String(value)
    );
  } catch {
    return "[Could not serialize diagnostic value]";
  }
}

export function describeError(error: unknown): string {
  const reports: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  for (let depth = 0; depth < 10; depth++) {
    if (seen.has(current)) {
      reports.push("[Circular cause]");
      break;
    }
    seen.add(current);
    try {
      if (typeof current !== "object" || current === null) {
        reports.push(formatDiagnostic(current));
        break;
      }
      const thrown = current;
      const details = Object.fromEntries(
        Object.getOwnPropertyNames(thrown)
          .filter((key) => key !== "cause")
          .map((key) => [key, Reflect.get(thrown, key)]),
      );
      reports.push(formatDiagnostic(details));
      if (!("cause" in current)) break;
      current = current.cause;
      if (depth === 9) reports.push("[Further causes omitted]");
    } catch {
      reports.push("[Could not inspect thrown value]");
      break;
    }
  }
  return reports.join("\nCaused by:\n");
}
