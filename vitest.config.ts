import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'node',
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules'],
    root: '.',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    conditions: ['import', 'node', 'default'],
  },
});
