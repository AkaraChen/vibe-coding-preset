import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { URL, fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const run = (...args) =>
  spawnSync("pnpm", ["exec", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

const output = (result) => `${result.stdout}\n${result.stderr}`;

test("ESLint base accepts valid TypeScript", () => {
  const result = run("eslint", "--config", "tests/configs/base.mjs", "tests/fixtures/valid.ts");
  assert.equal(result.status, 0, output(result));
});

test("ESLint type-aware catches Promise and any escape hatches", () => {
  const result = run(
    "eslint",
    "--config",
    "tests/configs/type-aware.mjs",
    "tests/fixtures/invalid.ts",
  );
  const diagnostics = output(result);
  assert.notEqual(result.status, 0, diagnostics);
  assert.match(diagnostics, /@typescript-eslint\/no-floating-promises/);
  assert.match(diagnostics, /@typescript-eslint\/no-explicit-any/);
});

test("ESLint React catches conditional hooks", () => {
  const result = run(
    "eslint",
    "--config",
    "tests/configs/react.mjs",
    "tests/fixtures/react-invalid.tsx",
  );
  const diagnostics = output(result);
  assert.notEqual(result.status, 0, diagnostics);
  assert.match(diagnostics, /react-hooks\/rules-of-hooks/);
});

test("Biome base accepts valid TypeScript", () => {
  const result = run(
    "biome",
    "lint",
    "--config-path",
    "tests/configs/biome-base.jsonc",
    "tests/fixtures/valid.ts",
    "--error-on-warnings",
  );
  assert.equal(result.status, 0, output(result));
});

test("Biome type-aware catches a floating Promise", () => {
  const result = run(
    "biome",
    "lint",
    "--config-path",
    "tests/configs/biome-type-aware.jsonc",
    "tests/fixtures/invalid.ts",
    "--error-on-warnings",
  );
  const diagnostics = output(result);
  assert.notEqual(result.status, 0, diagnostics);
  assert.match(diagnostics, /noFloatingPromises/);
});

test("Biome React catches a conditional hook", () => {
  const result = run(
    "biome",
    "lint",
    "--config-path",
    "tests/configs/biome-react.jsonc",
    "tests/fixtures/react-invalid.tsx",
    "--error-on-warnings",
  );
  const diagnostics = output(result);
  assert.notEqual(result.status, 0, diagnostics);
  assert.match(diagnostics, /useHookAtTopLevel/);
});
