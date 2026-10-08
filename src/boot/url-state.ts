export interface UrlCodec<T> {
  defaultState: T;
  decode: (value: unknown) => T;
  /** Optional tool-owned query transport; other tools use the base64 `s` payload. */
  query?: {
    decode: (params: URLSearchParams) => T;
    write: (params: URLSearchParams, state: T) => void;
  };
}

export type State<T> = [T, (update: T | ((previous: T) => T)) => void];

export type StateResult<T> =
  | { kind: "ok"; state: T }
  | { kind: "version-error" | "unpack-error"; message: string };

export class UnsupportedStateVersion extends Error {
  constructor() {
    super("This tool does not recognise the saved state version.");
    this.name = "UnsupportedStateVersion";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** URL-safe, unpadded base64 of UTF-8 JSON; the schema version belongs to each tool. */
export function packState(state: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function unpackState(payload: string): unknown {
  if (payload.length > 1_000_000 || !/^[\w-]+$/.test(payload)) {
    throw new Error("The saved state is not valid base64url.");
  }
  const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function readState<T>(payload: string | null, codec: UrlCodec<T>): StateResult<T> {
  if (payload === null) return { kind: "ok", state: codec.defaultState };
  try {
    return { kind: "ok", state: codec.decode(unpackState(payload)) };
  } catch (error) {
    return {
      kind: error instanceof UnsupportedStateVersion ? "version-error" : "unpack-error",
      message: error instanceof Error ? error.message : "The saved state could not be read.",
    };
  }
}

export function readQueryState<T>(params: URLSearchParams, codec: UrlCodec<T>): StateResult<T> {
  if (!codec.query) return readState(params.get("s"), codec);
  try {
    return { kind: "ok", state: codec.query.decode(params) };
  } catch (error) {
    return {
      kind: error instanceof UnsupportedStateVersion ? "version-error" : "unpack-error",
      message: error instanceof Error ? error.message : "The saved state could not be read.",
    };
  }
}
