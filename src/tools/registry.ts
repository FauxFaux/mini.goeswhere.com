import { Calculator } from "./calculator/page.tsx";
import { HelloWorld } from "./hello-world/page.tsx";
import { StrengthStandards } from "./strength-standards/page.tsx";

/** The directory and router both use this catalogue. */
export const tools = [
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
