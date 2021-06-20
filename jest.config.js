module.exports = {
  globalSetup: '<rootDir>/test/global-setup.ts',
  verbose: true,
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1'
  },
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/', '<rootDir>/data/'],
  setupFilesAfterEnv: ['jest-extended', '<rootDir>/test/setup.ts'],
  // transform: {
  //   '^.+\\.ts?$': 'ts-jest'
  // }
  preset: 'ts-jest'
}
