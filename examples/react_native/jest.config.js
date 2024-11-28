module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    '../../node_modules/(?!@react-native|react-native|expo-modules-core|burnt)',
  ],
  setupFiles: ['./setup-jest.js'],
};
