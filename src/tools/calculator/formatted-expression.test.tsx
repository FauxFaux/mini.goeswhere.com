// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { CalculatorFormattedExpression } from "./formatted-expression.tsx";

afterEach(cleanup);

describe("libqalculate markup rendering", () => {
  it("preserves colours, powers, subscripts, overlines and escaped symbols", () => {
    const { container } = render(
      <CalculatorFormattedExpression
        html={
          '<span style="color:#AAFFFF">2</span><i>x</i><sup>3</sup><sub><small>2</small></sub><span style="text-decoration: overline">1</span> &lt; &amp;'
        }
      />,
    );
    expect(container.textContent).toBe("2x321 < &");
    expect(container.querySelector("span")?.style.color).toBe("#aaffff");
    expect(container.querySelector("sup")?.textContent).toBe("3");
    expect(container.querySelector("sub small")?.textContent).toBe("2");
    expect(container.querySelectorAll("span")[1]?.style.textDecoration).toBe("overline");
  });

  it("drops active elements, attributes and unsupported styles", () => {
    const { container } = render(
      <CalculatorFormattedExpression
        html={
          '<script>alert(1)</script><img src="https://example.test/track" onerror="alert(1)"><svg onload="alert(1)"></svg><iframe srcdoc="bad"></iframe><span onclick="alert(1)" id="bad" style="color:red;background:url(https://example.test/track);position:fixed">safe</span><i onmouseover="alert(1)">x</i>'
        }
      />,
    );
    expect(container.textContent).toBe("safex");
    expect(
      container.querySelector("script, img, svg, iframe, [onclick], [onmouseover], #bad"),
    ).toBeNull();
    expect(container.querySelector("span")?.getAttribute("style") || "").toBe("");
  });
});
