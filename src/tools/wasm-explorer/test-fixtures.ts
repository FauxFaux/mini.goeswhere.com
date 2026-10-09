// Binary fixture builders shared by parser and interaction tests.
export const encode = (text: string) => Array.from(new TextEncoder().encode(text));
export function leb(value: number): number[] {
  const result: number[] = [];
  do {
    const byte = value % 128;
    value = Math.floor(value / 128);
    result.push(byte | (value ? 128 : 0));
  } while (value);
  return result;
}
export function string(text: string): number[] {
  const bytes = encode(text);
  return [...leb(bytes.length), ...bytes];
}
export function section(id: number, payload: number[]): number[] {
  return [id, ...leb(payload.length), ...payload];
}
export function custom(name: string, payload: number[]): number[] {
  return section(0, [...string(name), ...payload]);
}
export function moduleBytes(parts: number[][]): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, ...parts.flat()]);
}
export function fixture(metadata = true): Uint8Array<ArrayBuffer> {
  return moduleBytes([
    section(1, [1, 0x60, 0, 0]),
    section(2, [
      2,
      ...string("env"),
      ...string("memory"),
      2,
      0,
      1,
      ...string("env"),
      ...string("call"),
      0,
      0,
    ]),
    section(3, [1, 0]),
    section(7, [1, ...string("entry"), 0, 1]),
    section(10, [1, 2, 0, 0x0b]),
    section(11, [1, 1, 4, ...encode("data")]),
    ...(metadata
      ? [
          custom("name", [
            1,
            ...leb(2 + string("named").length),
            1,
            1,
            ...string("named"),
            9,
            ...leb(2 + string("table-data").length),
            1,
            0,
            ...string("table-data"),
          ]),
          custom("sourceMappingURL", string("fixture.wasm.map")),
          custom("external_debug_info", string("fixture.debug.wasm")),
          custom(".debug_info", [1, 2, 3]),
          custom("producers", [0]),
        ]
      : []),
    custom("application-metadata", [7, 8, 9]),
  ]);
}

export function mapping(values: number[]): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  return values
    .map((value) => {
      let integer = Math.abs(value) * 2 + (value < 0 ? 1 : 0);
      let result = "";
      do {
        const digit = integer % 32;
        integer = Math.floor(integer / 32);
        result += alphabet[digit + (integer ? 32 : 0)];
      } while (integer);
      return result;
    })
    .join("");
}
