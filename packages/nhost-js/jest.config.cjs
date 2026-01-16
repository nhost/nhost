module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@nhost/nhost-js$': '<rootDir>/src/index.ts',
    '^@nhost/nhost-js/auth$': '<rootDir>/src/auth/index.ts',
    '^@nhost/nhost-js/fetch$': '<rootDir>/src/fetch/index.ts',
    '^@nhost/nhost-js/functions$': '<rootDir>/src/functions/index.ts',
    '^@nhost/nhost-js/graphql$': '<rootDir>/src/graphql/index.ts',
    '^@nhost/nhost-js/session$': '<rootDir>/src/session/index.ts',
    '^@nhost/nhost-js/storage$': '<rootDir>/src/storage/index.ts',
  },
};
