import { UrlHandler } from "../../boot/url-handler.tsx";
import { LocationPickerControls } from "../../components/location-picker/controls.tsx";
import { locationPickerCodec } from "./state.ts";

export function LocationPicker() {
  return (
    <UrlHandler codec={locationPickerCodec} debounceMs={150}>
      {([state, setState]) => (
        <>
          <h1>Location picker</h1>
          <LocationPickerControls
            uss={[
              state.location,
              (update) =>
                setState((previous) => ({
                  ...previous,
                  location: typeof update === "function" ? update(previous.location) : update,
                })),
            ]}
          />
        </>
      )}
    </UrlHandler>
  );
}
