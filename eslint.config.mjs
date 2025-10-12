import {defineConfig} from "eslint/config";
import {fixupConfigRules, fixupPluginRules} from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import i18nValidator from "eslint-plugin-i18n-validator";
import _import from "eslint-plugin-import";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/typescript",
    )),

    plugins: {
        "@typescript-eslint": fixupPluginRules(typescriptEslint),
        "i18n-validator": i18nValidator,
        import: fixupPluginRules(_import),
    },

    languageOptions: {
        globals: {
            ...globals.commonjs,
            ...globals.node,
        },

        parser: tsParser,
        ecmaVersion: 2018,
        sourceType: "commonjs",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    settings: {
        "import/parsers": {
            "@typescript-eslint/parser": [".ts", ".tsx"],
        },

        "import/resolver": {
            typescript: {
                alwaysTryTypes: true,
            },
        },
    },

    rules: {
        "max-len": "off",
        "react/jsx-filename-extension": "off",
        "import/no-extraneous-dependencies": "off",
        semi: ["error", "always"],
        "object-curly-spacing": ["error", "always"],
        "import/prefer-default-export": "off",
        "import/extensions": ["off", "ignorePackages"],
        "no-console": "off",
        "import/no-duplicates": "error",

        quotes: ["error", "single", {
            avoidEscape: true,
        }],

        "i18n-validator/json-key-exists": ["error", {
            locales: ["hu/translation", "en-US/translation"],

            jsonBaseURIs: [{
                baseURI: "./src/locales",
            }],
        }],
    },
}]);
