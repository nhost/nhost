import { NewCustomer } from './components/new-customer'
import { Customers } from './components/customers'
import { NhostReactProvider } from '@nhost/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import { queryClient } from './utils/react-query-client'
import { nhost } from './utils/nhost'

function App() {
  return (
    <NhostReactProvider nhost={nhost}>
      <QueryClientProvider client={queryClient}>
        <div>
          <h1>GraphQL Code Generator example with React and React Query</h1>
          <div>
            <NewCustomer />
          </div>
          <div>
            <Customers />
          </div>
        </div>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </NhostReactProvider>
  )
}

export default App
