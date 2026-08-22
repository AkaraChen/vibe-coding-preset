import { defineConfig } from "oxlint";

const baseRules = {
  "array-callback-return": ["error", { checkForEach: true }],
  curly: ["error", "all"],
  eqeqeq: ["error", "always", { null: "ignore" }],
  "import/no-absolute-path": "error",
  "import/no-duplicates": "error",
  "import/no-named-as-default": "off",
  "import/no-self-import": "error",
  "no-alert": "error",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-implicit-coercion": "error",
  "no-new-func": "error",
  "no-promise-executor-return": "error",
  "no-template-curly-in-string": "error",
  "no-unreachable-loop": "error",
  "prefer-const": "error",
};

const strictRules = {
  ...baseRules,
  complexity: ["error", 20],
  "import/no-cycle": "error",
  "max-depth": ["error", 4],
  "max-nested-callbacks": ["error", 4],
  "max-params": ["error", 5],
  "no-console": "error",
  "no-param-reassign": "error",
  "no-restricted-globals": ["error", "event", "fdescribe", "fit"],
  "typescript/no-explicit-any": "error",
};

const typeAwareRules = {
  ...strictRules,
  "typescript/await-thenable": "error",
  "typescript/no-deprecated": "error",
  "typescript/no-floating-promises": "error",
  "typescript/no-misused-promises": "error",
  "typescript/no-unnecessary-condition": "error",
  "typescript/no-unsafe-argument": "error",
  "typescript/no-unsafe-assignment": "error",
  "typescript/no-unsafe-call": "error",
  "typescript/no-unsafe-member-access": "error",
  "typescript/no-unsafe-return": "error",
  "typescript/require-await": "error",
  "typescript/return-await": "error",
  "typescript/switch-exhaustiveness-check": "error",
};

export const base = defineConfig({
  categories: {
    correctness: "error",
    suspicious: "error",
  },
  plugins: ["eslint", "typescript", "import", "unicorn", "oxc"],
  rules: baseRules,
});

export const strict = defineConfig({
  categories: base.categories,
  plugins: base.plugins,
  rules: strictRules,
});

export const typeAware = defineConfig({
  categories: strict.categories,
  plugins: strict.plugins,
  rules: typeAwareRules,
});

export const react = defineConfig({
  categories: typeAware.categories,
  plugins: [...typeAware.plugins, "react"],
  rules: {
    ...typeAwareRules,
    "react/exhaustive-deps": "error",
    "react/hooks": "off",
    "react/rules-of-hooks": "error",
  },
});

export default typeAware;
