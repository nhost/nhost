module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/cypress/',
    '<rootDir>/out/',
    '<rootDir>/coverage/',
    '<rootDir>/.nyc_output/',
  ],
  moduleNameMapper: {
    '@components/(.*)': '<rootDir>/src/components/$1',
    '@modules/(.*)': '<rootDir>/src/modules/$1',
    '@theme/(.*)': '<rootDir>/src/theme/$1',
  },
}
