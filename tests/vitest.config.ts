import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js', '.jsx', '.json'],
  },
  ssr: {
    noExternal: [/^@oozcitak\//],
  },
  test: {
    testTimeout: 30_000,
    include: [
      ...configDefaults.include,
      '**/*.{test,tests,specs}.?(c|m)[jt]s?(x)',
    ],
  },
})
