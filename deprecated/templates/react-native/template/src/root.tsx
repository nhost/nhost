import { NhostClient, NhostProvider } from '@nhost/react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Main from '@screens/Main'
import { NhostApolloProvider } from '@nhost/react-apollo'

const nhost = new NhostClient({
  subdomain: '<subdomain>',
  region: '<region>',
  clientStorageType: 'react-native',
  clientStorage: AsyncStorage
})

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <Main />
      </NhostApolloProvider>
    </NhostProvider>
  )
}

export default App
