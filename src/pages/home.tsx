import { Link } from "wouter";
import { tools } from "../tools/registry.ts";

export function Home() {
  return (
    <>
      <h1>Mini tools</h1>
      <p>Small calculators, tools, and explainers.</p>
      <ul class="tool-list">
        {tools
          .filter((tool) => !("hidden" in tool && tool.hidden))
          .map((tool) => (
            <li key={tool.path}>
              <Link href={tool.path}>{tool.title}</Link>
              <p>{tool.description}</p>
            </li>
          ))}
      </ul>
    </>
  );
}
