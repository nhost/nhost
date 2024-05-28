jest.useFakeTimers();
import 'react-native-gesture-handler/jestSetup';
import WebSocket from 'ws';

Object.assign(global, {
  WebSocket,
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-document-picker', () => ({default: jest.fn()}));

jest.mock('@react-navigation/native/lib/commonjs/useLinking.native', () => ({
  default: () => ({getInitialState: {then: jest.fn()}}),
  __esModule: true,
}));
