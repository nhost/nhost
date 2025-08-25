import React from 'react';

import {NhostClient, NhostProvider} from '@nhost/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Main from '@screens/Main';
import {NhostApolloProvider} from '@nhost/react-apollo';
import {Platform} from 'react-native';

const nhost = new NhostClient({
  subdomain: Platform.OS === 'ios' ? 'local' : '10-0-2-2',
  region: 'local',
  clientStorageType: 'react-native',
  clientStorage: AsyncStorage,
});

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <Main />
      </NhostApolloProvider>
    </NhostProvider>
  );
}

export default App;
