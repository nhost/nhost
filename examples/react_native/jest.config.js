module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    '../../node_modules/(?!@react-native|react-native)',
  ],
  setupFiles: ['./setup-jest.js'],
};
