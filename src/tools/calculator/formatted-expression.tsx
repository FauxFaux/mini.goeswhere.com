import { h, type ComponentChildren } from "preact";
import { useMemo } from "preact/hooks";

const tags = new Set(["span", "i", "b", "sup", "sub", "small", "br"]);
const colours = new Set(["#aaffff", "#ffffaa", "#bbffbb", "#ffaaaa"]);

/** Rebuild libqalculate markup as VNodes without copying arbitrary HTML or attributes. */
function renderNode(node: Node): ComponentChildren {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as HTMLElement;
  const tag = element.localName;
  if (!tags.has(tag)) return null;
  const style: { color?: string; textDecoration?: string } = {};
  const colour = element.style.color.toLowerCase();
  // CSSOM normalizes hex colours to rgb() in browsers.
  const hex = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(colour);
  const normalized = hex
    ? `#${hex
        .slice(1)
        .map((channel) => Number(channel).toString(16).padStart(2, "0"))
        .join("")}`
    : colour;
  if (colours.has(normalized)) style.color = normalized;
  if (element.style.textDecoration === "overline") style.textDecoration = "overline";
  return h(tag, { style }, Array.from(element.childNodes, renderNode));
}

export function CalculatorFormattedExpression({ html }: { html: string }) {
  const children = useMemo(() => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return Array.from(template.content.childNodes, renderNode);
  }, [html]);
  return <>{children}</>;
}
