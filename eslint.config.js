import { base } from "@vibe-coding-preset/eslint-config";

export default [
  {
    name: "vibe-coding-preset/repository-ignores",
    ignores: [
      "tests/fixtures/invalid*",
      "tests/fixtures/react-invalid*",
      "implementations/**",
    ],
  },
  ...base,
];
