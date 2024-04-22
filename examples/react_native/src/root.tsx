import React from 'react';

import {NhostClient, NhostProvider} from '@nhost/react';
import Main from './screens/Main';

const nhost = new NhostClient({subdomain: 'local'});

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <Main />
    </NhostProvider>
  );
}

export default App;
