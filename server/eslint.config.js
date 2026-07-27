import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        File: "readonly",
        Blob: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^(supabaseAdmin|isConfigured)$" }],
      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    ignores: ["node_modules/**", "*.config.js"],
  },
];
