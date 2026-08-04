module.exports = {
  testEnvironment: 'node',
  // nanostores ships ESM only, so it must be transformed alongside the
  // TypeScript sources for jest's CJS runtime.
  transformIgnorePatterns: ['/node_modules/(?!nanostores/)'],
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsconfig: { allowJs: true },
    },
  },
};
