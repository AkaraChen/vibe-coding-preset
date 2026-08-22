import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});

if (
  process.env.DATABASE_URL === undefined ||
  process.env.DATABASE_URL.length === 0
) {
  process.env.DATABASE_URL =
    "postgres://workboard:workboard@127.0.0.1:55432/workboard";
}
