import './App.css'
import { NhostReactProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { nhost } from './utils/nhost'
import { Route, Routes } from 'react-router'
import { Layout } from './components/ui/Layout'
import { Customers } from './components/Customers'
import { Dashboard } from './components/Dashboard'
import { NewCustomer } from './components/NewCustomer'
import { RequireAuth } from './components/RequireAuth'
import { Customer } from './components/Customer'
import { SignUp } from './components/SignUp'
import { SignIn } from './components/SignIn'
import { ResetPassword } from './components/ResetPassword'
import { Settings } from './components/settings/Settings'

function App() {
  return (
    <NhostReactProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <AppRouter />
      </NhostApolloProvider>
    </NhostReactProvider>
  )
}

function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Routes that are protected. I.e user must be signed in. */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders">
          <Route path="" element={<div>Coming soon...</div>} />
        </Route>
        <Route path="/customers">
          <Route path="" element={<Customers />} />
          <Route path=":customerId" element={<Customer />}>
            <Route path="" element={<div>some information</div>} />
            <Route path="orders" element={<div>Orders..</div>} />
            <Route path="files" element={<div>Files..</div>} />
          </Route>
          <Route path="new" element={<NewCustomer />} />
        </Route>
        <Route path="/settings">
          <Route path="" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
