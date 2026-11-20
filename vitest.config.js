import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Telas do SGHx são simuladas com fixtures HTML no jsdom.
    // Testes que precisam de Node puro usam `// @vitest-environment node`.
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
