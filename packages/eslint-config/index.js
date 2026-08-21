import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import js from "@eslint/js";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const sourceFiles = ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"];
const typeScriptFiles = ["**/*.{ts,mts,cts,tsx}"];

const scopeTypeScript = (configs, layer) =>
  configs.map((config, index) => ({
    ...config,
    name: `vibe-coding-preset/${layer}-${index}`,
    files: typeScriptFiles,
  }));

const ignores = {
  name: "vibe-coding-preset/ignores",
  ignores: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.next/**",
    "**/vendor/**",
    "**/*.min.js",
  ],
};

const common = {
  name: "vibe-coding-preset/base",
  files: sourceFiles,
  plugins: {
    "@eslint-community/eslint-comments": eslintComments,
    "import-x": importX,
  },
  linterOptions: {
    reportUnusedDisableDirectives: "error",
    reportUnusedInlineConfigs: "error",
  },
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "@eslint-community/eslint-comments/disable-enable-pair": "error",
    "@eslint-community/eslint-comments/no-duplicate-disable": "error",
    "@eslint-community/eslint-comments/no-unlimited-disable": "error",
    "@eslint-community/eslint-comments/no-unused-disable": "error",
    "@eslint-community/eslint-comments/require-description": "error",
    "array-callback-return": ["error", { checkForEach: true }],
    curly: ["error", "all"],
    eqeqeq: ["error", "always", { null: "ignore" }],
    "import-x/no-absolute-path": "error",
    "import-x/no-duplicates": "error",
    "import-x/no-self-import": "error",
    "no-alert": "error",
    "no-constructor-return": "error",
    "no-eval": "error",
    "no-extend-native": "error",
    "no-implied-eval": "error",
    "no-implicit-coercion": "error",
    "no-new-func": "error",
    "no-promise-executor-return": "error",
    "no-template-curly-in-string": "error",
    "no-unmodified-loop-condition": "error",
    "no-unreachable-loop": "error",
    "no-useless-assignment": "error",
    "prefer-const": "error",
  },
};

export const base = [
  ignores,
  {
    ...js.configs.recommended,
    name: "vibe-coding-preset/javascript-recommended",
    files: sourceFiles,
  },
  ...scopeTypeScript(tseslint.configs.recommended, "typescript-recommended"),
  common,
];

export const strict = [
  ...base,
  ...scopeTypeScript(tseslint.configs.strict, "typescript-strict"),
  {
    name: "vibe-coding-preset/strict",
    files: sourceFiles,
    rules: {
      complexity: ["error", { max: 20 }],
      "import-x/no-cycle": ["error", { ignoreExternal: true, maxDepth: 8 }],
      "max-depth": ["error", 4],
      "max-nested-callbacks": ["error", 4],
      "max-params": ["error", 5],
      "no-console": "error",
      "no-param-reassign": "error",
      "no-restricted-globals": ["error", "event", "fdescribe", "fit"],
      "no-return-await": "error",
      "no-throw-literal": "error",
      "require-atomic-updates": "error",
    },
  },
  {
    name: "vibe-coding-preset/typescript-strict-overrides",
    files: typeScriptFiles,
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", prefer: "type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-return-await": "off",
      "no-throw-literal": "off",
    },
  },
];

export const typeAware = [
  ...strict,
  ...scopeTypeScript(
    tseslint.configs.recommendedTypeChecked,
    "typescript-recommended-type-checked",
  ),
  ...scopeTypeScript(tseslint.configs.strictTypeChecked, "typescript-strict-type-checked"),
  {
    name: "vibe-coding-preset/type-aware",
    files: typeScriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreIIFE: false, ignoreVoid: false },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksConditionals: true, checksSpreads: true, checksVoidReturn: true },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-return-await": "off",
      "require-await": "off",
    },
  },
];

export const react = [
  ...typeAware,
  {
    name: "vibe-coding-preset/react",
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.flat["recommended-latest"].rules,
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
    },
  },
];

export default typeAware;
