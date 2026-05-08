// Jest configuration. Plain JS to avoid pulling in ts-node just to read this
// file. The package itself uses `"type": "module"`, so this file is ESM.

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // ts-jest in ESM mode requires .js suffixes for relative imports;
    // this maps them back to the corresponding .ts source files.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts', '!src/ha-types.ts'],
};

export default config;
