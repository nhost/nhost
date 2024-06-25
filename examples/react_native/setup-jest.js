import 'react-native-gesture-handler/jestSetup';
import WebSocket from 'ws';

import MockBroadcastChannel from './__mocks__/BroadcastChannel';

jest.useFakeTimers();

Object.assign(global, {
  WebSocket,
  BroadcastChannel: MockBroadcastChannel,
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-document-picker', () => ({default: jest.fn()}));

jest.mock('@react-navigation/native/lib/commonjs/useLinking.native', () => ({
  default: () => ({getInitialState: {then: jest.fn()}}),
  __esModule: true,
}));
