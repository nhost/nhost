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
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="/customers">
        <Route
          path=""
          element={
            <RequireAuth>
              <Layout>
                <Customers />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path=":customerId"
          element={
            <RequireAuth>
              <Layout>
                <Customer />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="new"
          element={
            <RequireAuth>
              <Layout>
                <NewCustomer />
              </Layout>
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
