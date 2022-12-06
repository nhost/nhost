import { NhostProvider } from '@nhost/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Customers } from './components/customers'
import { NewCustomer } from './components/new-customer'
import { nhost } from './utils/nhost'
import { queryClient } from './utils/react-query-client'

function App() {
  return (
    <NhostProvider nhost={nhost}>
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
    </NhostProvider>
  )
}

export default App
