import { AuthProvider } from "./providers/auth";
import * as ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/globals.css";
import { NhostApolloProvider } from "./providers/apollo";
import { NhostProvider } from "./providers/nhost";

import { createClient } from "@nhost/nhost-js";

const nhost = createClient({
  region: "local",
  subdomain: "local",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NhostProvider nhost={nhost}>
    <AuthProvider>
      <NhostApolloProvider nhost={nhost}>
        <TooltipProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </NhostApolloProvider>
    </AuthProvider>
  </NhostProvider>,
);
