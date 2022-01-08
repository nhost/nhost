import "./App.css";
import { NhostAuthProvider } from "@nhost/react-auth";
import { NhostApolloProvider } from "@nhost/react-apollo";
import { nhost } from "./utils/nhost";
import { Route, Routes } from "react-router";
import { Layout } from "./components/ui/Layout";
import { Customers } from "./components/Customers";
import { Dashboard } from "./components/Dashboard";
import { NewCustomer } from "./components/NewCustomer";
import { RequireAuth } from "./components/RequireAuth";
import { Customer } from "./components/Customer";
import { SignUp } from "./components/SignUp";
import { SignIn } from "./components/SignIn";
import { ResetPassword } from "./components/ResetPassword";

function App() {
  return (
    <NhostAuthProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <AppRouter />
      </NhostApolloProvider>
    </NhostAuthProvider>
  );
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
          <Route path="" element={<div>Coming soon...</div>} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
