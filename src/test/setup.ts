import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";

// jest-dom registers itself through the import above; jest-axe has to be
// extended explicitly so `toHaveNoViolations` is available in every test file.
expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});

// jest-axe ships no types, so declare the matcher it adds to vitest's expect.
// The `any` default matches vitest's own declaration; interface merging
// requires identical type parameters.
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
