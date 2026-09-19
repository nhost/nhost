module.exports = {
  preset: 'ts-jest',
  // The toolbar is a DOM component: everything below `mount` needs a document,
  // a window and requestAnimationFrame.
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@nhost/devtools$': '<rootDir>/src/index.ts',
    '^@nhost/devtools/react$': '<rootDir>/src/react/index.tsx',
  },
};
