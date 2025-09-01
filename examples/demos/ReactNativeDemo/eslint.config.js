// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslint from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactPlugin from "eslint-plugin-react";

export default defineConfig([
  // Base configs
  eslint.configs.recommended,

  // TypeScript configs (properly structured for ESLint 9)
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylistic,

  // Project ignores
  {
    ignores: [
      "dist/*",
      "node_modules",
      ".expo",
      "coverage",
      "babel.config.js",
      "metro.config.js",
      "eslint.config.js",
      "package.json",
    ],
  },

  // TypeScript project config
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React-specific configuration
  {
    files: ["**/*.{tsx,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readonly",
        JSX: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    // Only define React-related plugins here to avoid conflicts
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,

      // React hooks
      ...reactHooks.configs.recommended.rules,

      // Allow async event handlers for React 19
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
    },
  },
]);
