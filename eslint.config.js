import eslint    from '@eslint/js';
import tseslint  from 'typescript-eslint';

/**
 * Downgrades every rule of the given configs from "error" to "warn",
 * so the linter reports all findings but never breaks a build.
 * Remove this (or individual rules) once the findings are fixed.
 */
function asWarnings(configs) {

    return configs.map(config => {

        if (!config.rules)
            return config;

        const rules = {};

        for (const [name, setting] of Object.entries(config.rules))
        {

            if (setting === 'error' || setting === 2)
                rules[name] = 'warn';

            else if (Array.isArray(setting) && (setting[0] === 'error' || setting[0] === 2))
                rules[name] = ['warn', ...setting.slice(1)];

            else
                rules[name] = setting;

        }

        return { ...config, rules };

    });

}

export default tseslint.config(

    {
        ignores: [
            'build/**',
            'docs/**',
            '**/*.js',
            '**/*.cjs',
            '**/*.mjs',
            '**/*.d.ts'
        ]
    },

    {

        files:    [ 'src/ts/**/*.ts', 'tests/**/*.ts' ],

        extends:  asWarnings([
                      eslint.configs.recommended,
                      ...tseslint.configs.strictTypeChecked
                  ]),

        languageOptions: {
            parserOptions: {
                project:          './tsconfig.eslint.json',
                tsconfigRootDir:  import.meta.dirname
            }
        }
    },

    // Rules that are completely worked off are promoted back to "error"
    // for the whole code base, so they cannot silently regress:
    {
        rules: {
            "prefer-const":                                                "error",
            "@typescript-eslint/no-explicit-any":                          "error",
            "@typescript-eslint/no-empty-object-type":                     "error",
            "@typescript-eslint/no-base-to-string":                        "error",
            "@typescript-eslint/await-thenable":                           "error",
            "@typescript-eslint/adjacent-overload-signatures":             "error",
            "@typescript-eslint/explicit-function-return-type":            "error",
            "@typescript-eslint/explicit-module-boundary-types":           "error",
            "@typescript-eslint/no-extraneous-class":                      "error",
            "@typescript-eslint/no-duplicate-enum-values":                 "error",
            "@typescript-eslint/no-floating-promises":                     "error",
            "@typescript-eslint/no-implied-eval":                          "error",
            "@typescript-eslint/no-confusing-void-expression":             "error",
            "@typescript-eslint/no-array-delete":                          "error",
            "@typescript-eslint/no-dynamic-delete":                        "error",
            "@typescript-eslint/no-import-type-side-effects":              "error",
            "@typescript-eslint/no-invalid-void-type":                     "error",
            "@typescript-eslint/no-meaningless-void-operator":             "error",
            "@typescript-eslint/no-misused-promises":                      "error",
            "@typescript-eslint/no-non-null-assertion":                    "error",
            "@typescript-eslint/no-unnecessary-condition":                 "error",
            "@typescript-eslint/no-unnecessary-boolean-literal-compare":   "error",
            "@typescript-eslint/no-unnecessary-type-assertion":            "error",
            "@typescript-eslint/no-unnecessary-type-conversion":           "error",
            "@typescript-eslint/no-unnecessary-type-parameters":           "error",
            "@typescript-eslint/only-throw-error":                         "error",
            "@typescript-eslint/prefer-nullish-coalescing":                "error",
            "@typescript-eslint/prefer-optional-chain":                    "error",
            "@typescript-eslint/prefer-includes":                          "error",
            "@typescript-eslint/prefer-string-starts-ends-with":           "error",
            "@typescript-eslint/prefer-as-const":                          "error",
            "@typescript-eslint/prefer-find":                              "error",
            "@typescript-eslint/prefer-for-of":                            "error",
            "@typescript-eslint/prefer-function-type":                     "error",
            "@typescript-eslint/prefer-readonly":                          "error",
            "@typescript-eslint/promise-function-async":                   "error",
            "@typescript-eslint/require-array-sort-compare":               "error",
            "@typescript-eslint/no-unsafe-argument":                       "error",
            "@typescript-eslint/no-unsafe-assignment":                     "error",
            "@typescript-eslint/no-unsafe-call":                           "error",
            "@typescript-eslint/no-unsafe-enum-comparison":                "error",
            "@typescript-eslint/no-unsafe-member-access":                  "error",
            "@typescript-eslint/no-unsafe-return":                         "error",
            "@typescript-eslint/consistent-type-imports":                  "error",
            "@typescript-eslint/require-await":                            "error",
            "@typescript-eslint/no-non-null-asserted-optional-chain":      "error",
            "@typescript-eslint/no-useless-constructor":                   "error",
            "@typescript-eslint/return-await":                             [ "error", "in-try-catch" ],
            "@typescript-eslint/restrict-plus-operands":                   "error",
            "@typescript-eslint/restrict-template-expressions":            [ "error", { allowNumber: true } ],
            "@typescript-eslint/strict-boolean-expressions":               "error",
            "@typescript-eslint/switch-exhaustiveness-check":              [ "error", { considerDefaultExhaustiveForUnions: true } ],
            "@typescript-eslint/unified-signatures":                       "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ],
            "no-case-declarations":                                        "off",
            "no-sparse-arrays":                                            "off",
            "no-prototype-builtins":                                       "off"
        }
    },

    // chargyApp.ts is the legacy browser/Electron UI integration layer.  It still
    // contains dynamic CommonJS imports and several untyped runtime APIs, so the
    // Core-level strict rules remain visible there as warnings while newer and
    // smaller files stay on the stricter error profile above.
    {
        files: [ "src/ts/chargyApp.ts" ],
        rules: {
            "@typescript-eslint/no-explicit-any":                         "warn",
            "@typescript-eslint/no-unsafe-assignment":                    "warn",
            "@typescript-eslint/no-unsafe-call":                          "warn",
            "@typescript-eslint/no-unsafe-member-access":                 "warn",
            "@typescript-eslint/no-unsafe-argument":                      "warn",
            "@typescript-eslint/no-unsafe-return":                        "warn",
            "@typescript-eslint/no-unsafe-enum-comparison":               "warn",
            "@typescript-eslint/explicit-function-return-type":           "warn",
            "@typescript-eslint/explicit-module-boundary-types":          "warn",
            "@typescript-eslint/restrict-plus-operands":                  "warn",
            "@typescript-eslint/strict-boolean-expressions":              "warn",
            "@typescript-eslint/no-unnecessary-condition":                "warn",
            "@typescript-eslint/prefer-nullish-coalescing":               "warn",
            "@typescript-eslint/await-thenable":                          "warn",
            "@typescript-eslint/no-confusing-void-expression":            "warn",
            "@typescript-eslint/require-await":                           "warn",
            "@typescript-eslint/switch-exhaustiveness-check":             "warn",
            "@typescript-eslint/prefer-for-of":                           "warn",
            "@typescript-eslint/no-base-to-string":                       "warn",
            "@typescript-eslint/no-unused-vars":                          "warn",
            "@typescript-eslint/no-non-null-assertion":                   "warn",
            "no-empty":                                                   "warn",
            "no-var":                                                     "warn"
        }
    }

);
