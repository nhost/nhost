import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";

export default defineConfigWithVueTs(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylistic,
  {
    // Vue demo specific ignores
    ignores: [
      "dist",
      "build",
      "node_modules",
      ".vite",
      "coverage",
      "vite.config.ts",
      "vite.config.d.ts",
      "eslint.config.mjs",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.{ts,mts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      // Vue recommended rules
      ...pluginVue.configs["flat/essential"].rules,
      ...pluginVue.configs["flat/strongly-recommended"].rules,
      ...pluginVue.configs["flat/recommended"].rules,

      // Allow async event handlers for Vue (matching React config)
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],

      // Disable floating promises rule for Vue composition API (matching React config)
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  // Include Vue TypeScript configurations
  vueTsConfigs.recommended,
);
