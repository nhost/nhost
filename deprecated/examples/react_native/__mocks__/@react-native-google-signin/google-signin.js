jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(() => Promise.resolve({idToken: 'test-token'})),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
  },
}));
