// ESLint settings used by the SharePoint Framework build (heft), from the SPFx
// 1.23.2 generator. Two style rules are turned off for this project:
// - @rushstack/no-new-null: the app uses null on purpose for "nothing chosen
//   yet" (for example a row with no shared receipt), matching stored values.
// - @typescript-eslint/explicit-function-return-type: local event handlers
//   rely on type inference; the strict TypeScript check still applies.
// "void" is allowed as a statement, to mark a promise whose errors are
// already handled inside the function it calls (no-floating-promises).
const spfxProfile = require('@microsoft/eslint-config-spfx/lib/flat-profiles/react');

module.exports = [
  ...spfxProfile,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.json'
      }
    },
    rules: {
      '@rushstack/no-new-null': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-void': ['warn', { allowAsStatement: true }]
    }
  }
];
