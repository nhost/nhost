import { NhostProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { Customers } from './components/customers'
import { NewCustomer } from './components/new-customer'
import { nhost } from './utils/nhost'

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <div>
          <h1>GraphQL Code Generator example with React and Apollo</h1>
          <div>
            <NewCustomer />
          </div>
          <div>
            <Customers />
          </div>
        </div>
      </NhostApolloProvider>
    </NhostProvider>
  )
}

export default App
