import { react } from "@vibe-coding-preset/eslint-config";

export default [
  {
    name: "workboard-guarded/ignores",
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "packages/db/drizzle/**",
      "data/**",
    ],
  },
  ...react,
  {
    name: "workboard-guarded/web-boundaries",
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@workboard/db",
              message: "apps/web cannot import the database package.",
            },
            {
              name: "@workboard/storage",
              message: "apps/web cannot import storage adapters.",
            },
            {
              name: "drizzle-orm",
              message: "apps/web cannot import drizzle-orm.",
            },
            {
              name: "postgres",
              message: "apps/web cannot import postgres.",
            },
          ],
          patterns: [
            {
              group: [
                "@workboard/db/*",
                "@workboard/storage/*",
                "drizzle-orm/*",
              ],
              message:
                "apps/web cannot import db, storage, or drizzle internals.",
            },
          ],
        },
      ],
    },
  },
];
