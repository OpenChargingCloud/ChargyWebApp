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

    }

);
