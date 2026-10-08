import { lazy } from "preact/compat";

/** The directory and router both use this catalogue. Tool modules load on demand. */
export const tools = [
  {
    path: "/calculator",
    title: "Calculator",
    description: "A grid of expressions and their results.",
    component: lazy(() =>
      import("./calculator/page.tsx").then((module) => ({ default: module.Calculator })),
    ),
  },
  {
    path: "/strength-standards",
    title: "Strength standards",
    description: "Starting Strength tables for five lifts, in kilograms or pounds.",
    component: lazy(() =>
      import("./strength-standards/page.tsx").then((module) => ({
        default: module.StrengthStandards,
      })),
    ),
  },
  {
    path: "/hello-world",
    title: "Hello world",
    description: "A small, personalised greeting.",
    component: lazy(() =>
      import("./hello-world/page.tsx").then((module) => ({ default: module.HelloWorld })),
    ),
  },
];
