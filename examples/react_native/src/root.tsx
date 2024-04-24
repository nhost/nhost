import React from 'react';

import {NhostClient, NhostProvider} from '@nhost/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Main from './screens/Main';

const nhost = new NhostClient({
  subdomain: 'local',
  clientStorageType: 'react-native',
  clientStorage: AsyncStorage,
});

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <Main />
    </NhostProvider>
  );
}

export default App;
