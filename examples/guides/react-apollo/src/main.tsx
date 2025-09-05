import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ApolloProvider } from "@apollo/client";
import App from "./App";
import { useApolloClient } from "./lib/graphql/apolloClient";
import { AuthProvider } from "./lib/nhost/AuthProvider";

// Wrapper component that provides Apollo client using the Nhost client from AuthProvider
const ApolloProviderWithAuth = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const apolloClient = useApolloClient();
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
};

// Root component that sets up providers
const Root = () => (
  <React.StrictMode>
    <AuthProvider>
      <ApolloProviderWithAuth>
        <App />
      </ApolloProviderWithAuth>
    </AuthProvider>
  </React.StrictMode>
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<Root />);
