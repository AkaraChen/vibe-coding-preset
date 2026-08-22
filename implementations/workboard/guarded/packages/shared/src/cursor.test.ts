import { expect, test } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor.ts";

test("encodeCursor/decodeCursor round-trip", () => {
  const cursor = {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111",
  };
  expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
});

test("decodeCursor rejects junk", () => {
  expect(decodeCursor("not-a-cursor")).toBeUndefined();
  expect(
    decodeCursor(Buffer.from("{}", "utf8").toString("base64url")),
  ).toBeUndefined();
});
