/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  // example-*/ are test fixtures bind-mounted into containers, not jest
  // modules. Excluding them silences the haste-map "functions-example" name
  // collision (each example's package.json declares the same name).
  modulePathIgnorePatterns: ['<rootDir>/example-'],
};
