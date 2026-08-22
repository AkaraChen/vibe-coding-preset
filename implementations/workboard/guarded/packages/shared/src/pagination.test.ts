import { expect, test } from "vitest";
import { offsetForPage, parsePageQuery } from "./pagination.ts";

test("parsePageQuery defaults and clamps", () => {
  expect(parsePageQuery(undefined, undefined)).toEqual({
    page: 1,
    pageSize: 20,
  });
  expect(parsePageQuery("2", "100")).toEqual({ page: 2, pageSize: 100 });
  expect(parsePageQuery("0", "999")).toEqual({ page: 1, pageSize: 100 });
});

test("offsetForPage is stable", () => {
  expect(offsetForPage(1, 20)).toBe(0);
  expect(offsetForPage(3, 20)).toBe(40);
});
