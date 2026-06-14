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
            'prefer-const':                                            'error',
            '@typescript-eslint/no-non-null-asserted-optional-chain':  'error',
            '@typescript-eslint/restrict-template-expressions':        'error',
            '@typescript-eslint/no-empty-object-type':                 'error',
            '@typescript-eslint/no-useless-constructor':               'error',
            '@typescript-eslint/only-throw-error':                     'error',
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                {
                    allowNumber: true
                }
            ]
        }
    },

    // Warning-free files are promoted back to the original "error" severity,
    // so they cannot silently regress:
    {
        files: [
            'src/ts/OCPI.ts',
            'src/ts/QIDigital_DCoA.ts',
            'src/ts/QIDigital_DCoC.ts',
            'src/ts/chargyLib.ts',
            'src/ts/qrReader.ts',
            'src/ts/ACrypt.ts',
            'src/ts/CanonicalJSON.ts',
            'src/ts/CryptoUtils.ts'
        ],
        rules: Object.assign({}, ...tseslint.configs.strictTypeChecked.map(config => config.rules ?? {}))
    }

);
