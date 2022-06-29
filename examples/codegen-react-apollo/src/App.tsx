import { NewCustomer } from './components/new-customer'
import { Customers } from './components/customers'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { nhost } from './utils/nhost'
import { NhostReactProvider } from '@nhost/react'

function App() {
  return (
    <NhostReactProvider nhost={nhost}>
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
    </NhostReactProvider>
  )
}

export default App
