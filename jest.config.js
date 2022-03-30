module.exports = {
  roots: ['./test'],
  globals: {
    server: null,
  },
  globalSetup: '<rootDir>/test/global-setup.ts',
  verbose: false,
  moduleNameMapper: {
    '^@config$': '<rootDir>/src/config',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
    '<rootDir>/data/',
  ],
  setupFilesAfterEnv: ['jest-extended'],
  preset: 'ts-jest',
  testEnvironment: 'node',
}
