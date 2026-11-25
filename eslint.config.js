import tseslint from 'typescript-eslint';

// Functions whose results may differ between browsers or CPUs, and sources of
// time or randomness. None of them may appear in the simulation.
const banned = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'log', 'log2', 'log10', 'pow', 'hypot', 'cbrt', 'sinh', 'cosh', 'tanh', 'expm1', 'log1p', 'random'];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'off',
    },
  },
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-properties': ['error', ...banned.map((property) => ({ object: 'Math', property, message: 'Not deterministic across machines. Use packages/sim/src/dmath.ts.' }))],
      'no-restricted-globals': ['error', { name: 'Date', message: 'No wall-clock time in the simulation.' }, { name: 'performance', message: 'No wall-clock time in the simulation.' }, { name: 'window', message: 'The simulation is engine-free.' }, { name: 'document', message: 'The simulation is engine-free.' }, { name: 'navigator', message: 'The simulation is engine-free.' }],
      'no-restricted-imports': ['error', { patterns: [{ group: ['@rw/hulls', '**/apps/**', '**/hulls/**'], message: 'The simulation must not import the renderer or hulls.' }] }],
      'no-restricted-syntax': ['error', { selector: "BinaryExpression[operator='**']", message: 'Use explicit multiplication; ** maps to Math.pow.' }],
    },
  },
);
