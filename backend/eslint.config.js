import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,

    // Your source files
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-console": "off",
        },
    },
];