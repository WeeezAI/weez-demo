import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

/**
 * Smoke test for the test runner itself: it proves the jsdom environment is
 * live, the jest-dom and jest-axe matchers are registered by src/test/setup.ts,
 * React components render and respond to user-event, and the `@` path alias
 * resolves the same way it does in the app build.
 */
describe("frontend test runner", () => {
  it("runs in a live jsdom environment", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Open LinkedIn & Send";
    document.body.appendChild(button);

    expect(document.querySelector("button")?.textContent).toBe(
      "Open LinkedIn & Send",
    );

    button.remove();
  });

  it("registers the jest-dom matchers", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Waiting for confirmation";
    document.body.appendChild(paragraph);

    expect(paragraph).toBeInTheDocument();
    expect(paragraph).toHaveTextContent("Waiting for confirmation");

    paragraph.remove();
    expect(paragraph).not.toBeInTheDocument();
  });

  it("registers the jest-axe matcher", async () => {
    const main = document.createElement("main");
    main.innerHTML = [
      "<h1>Relationship intelligence</h1>",
      '<button type="button">Open LinkedIn &amp; Send</button>',
    ].join("");
    document.body.appendChild(main);

    const results = await axe(main);
    expect(results).toHaveNoViolations();

    main.remove();
  });

  it("renders React components and handles user-event interaction", async () => {
    const Counter = () => {
      const [count, setCount] = useState(0);
      return (
        <button type="button" onClick={() => setCount((n) => n + 1)}>
          Opened {count} times
        </button>
      );
    };

    render(<Counter />);
    const control = screen.getByRole("button", { name: /opened 0 times/i });

    await userEvent.click(control);

    expect(
      screen.getByRole("button", { name: /opened 1 times/i }),
    ).toBeInTheDocument();
  });

  it("resolves the @ path alias", () => {
    expect(cn("px-2", "py-2")).toBe("px-2 py-2");
  });
});
