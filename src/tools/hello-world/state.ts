import { isRecord, UnsupportedStateVersion, type UrlCodec } from "../../boot/url-state.ts";

export interface HelloWorldState {
  v: 1;
  name: string;
}

export const MAX_NAME_LENGTH = 100;

export const helloWorldCodec: UrlCodec<HelloWorldState> = {
  defaultState: { v: 1, name: "world" },
  decode(value) {
    if (!isRecord(value)) throw new Error("Hello world state must be an object.");
    if (value.v !== 1) throw new UnsupportedStateVersion();
    if (typeof value.name !== "string" || value.name.length > MAX_NAME_LENGTH) {
      throw new Error("Hello world state must contain a valid name.");
    }
    return { v: 1, name: value.name };
  },
};
