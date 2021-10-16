module.exports = {
  roots: ['./test'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  verbose: false,
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
    '<rootDir>/data/',
  ],
  setupFilesAfterEnv: ['jest-extended', '<rootDir>/test/setup.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
};
