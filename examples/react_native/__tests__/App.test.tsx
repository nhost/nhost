import 'react-native';
import React from 'react';
import App from 'src/root';
import {MockedProvider} from '@apollo/client/testing';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

it('renders correctly', () => {
  renderer.create(
    <MockedProvider mocks={[]} addTypename={false}>
      <App />
    </MockedProvider>,
  );
});
