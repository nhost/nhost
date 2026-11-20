// Packages that ship untranspiled source and must go through Babel. The
// optional `.pnpm/<name>@<version>/node_modules/` prefix matches pnpm's layout,
// so only these packages are transformed instead of everything under `.pnpm`.
const TRANSFORM = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo',
  '@expo',
  'react-navigation',
  '@react-navigation',
  'standard-navigation',
];

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    `/node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?(${TRANSFORM.join('|')}))`,
    '/node_modules/@react-native/babel-preset/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/ios/',
    '<rootDir>/android/',
  ],
};
