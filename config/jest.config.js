module.exports = {
  rootDir: process.cwd(),
  preset: 'ts-jest',
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
  verbose: true,
  testTimeout: 30000,
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
}
