import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { UrqlProvider } from "./lib/graphql/UrqlProvider";
import { AuthProvider } from "./lib/nhost/AuthProvider";

// Root component that sets up providers
const Root = () => (
  <React.StrictMode>
    <AuthProvider>
      <UrqlProvider>
        <App />
      </UrqlProvider>
    </AuthProvider>
  </React.StrictMode>
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(<Root />);
