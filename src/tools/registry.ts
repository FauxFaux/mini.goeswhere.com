import { AnalogueClock } from "./analogue-clock/page.tsx";
import { Calculator } from "./calculator/page.tsx";
import { EarthMoon } from "./earth-moon/page.tsx";
import { HelloWorld } from "./hello-world/page.tsx";
import { LocationPicker } from "./location-picker/page.tsx";
import { StrengthStandards } from "./strength-standards/page.tsx";
import { WasmExplorer } from "./wasm-explorer/page.tsx";

/** The directory and router both use this catalogue. */
export const tools = [
  {
    path: "/wasm-explorer",
    title: "WASM explorer",
    description: "Inspect binary sizes, code, data, debug metadata and source attribution.",
    component: WasmExplorer,
  },
  {
    path: "/earth-moon",
    title: "Earth and Moon",
    description: "A 3D globe, lunar orbit and the sky above your location.",
    component: EarthMoon,
  },
  {
    path: "/location-picker",
    title: "Location picker",
    description: "Pick coordinates on a Goode homolosine world map.",
    component: LocationPicker,
  },
  {
    path: "/analogue-clock",
    title: "Analogue clock",
    description: "A large clock with hands you can drag.",
    component: AnalogueClock,
  },
  {
    path: "/calculator",
    title: "Calculator",
    description: "A grid of expressions and their results.",
    component: Calculator,
  },
  {
    path: "/strength-standards",
    title: "Strength standards",
    description: "Starting Strength tables for five lifts, in kilograms or pounds.",
    component: StrengthStandards,
  },
  {
    path: "/hello-world",
    title: "Hello world",
    description: "A small, personalised greeting.",
    component: HelloWorld,
  },
];
