import { UrlHandler } from "../../boot/url-handler.tsx";
import type { State } from "../../boot/url-state.ts";
import { helloWorldCodec, MAX_NAME_LENGTH, type HelloWorldState } from "./state.ts";

export function HelloWorld() {
  return <UrlHandler codec={helloWorldCodec}>{(uss) => <Greeting uss={uss} />}</UrlHandler>;
}

function Greeting({ uss: [us, setUs] }: { uss: State<HelloWorldState> }) {
  return (
    <>
      <h1>Hello world</h1>
      <p>
        <label for="greeting-name">Your name</label>
      </p>
      <input
        id="greeting-name"
        type="text"
        value={us.name}
        maxLength={MAX_NAME_LENGTH}
        onInput={(event) => setUs({ ...us, name: event.currentTarget.value })}
      />
      <p>
        <output for="greeting-name" aria-live="polite">
          Hello, {us.name.trim() || "world"}!
        </output>
      </p>
      <p class="muted">Your greeting is saved in this page’s URL. Copy the address to share it.</p>
    </>
  );
}
