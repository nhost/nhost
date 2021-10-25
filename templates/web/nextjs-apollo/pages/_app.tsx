import "../styles/globals.css";
import type { AppProps } from "next/app";
import { NhostAuthProvider } from "@nhost/react-auth";
import { NhostApolloProvider } from "@nhost/react-apollo";

import { nhost } from "../utils/nhost";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NhostAuthProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <Component {...pageProps} />
      </NhostApolloProvider>
    </NhostAuthProvider>
  );
}
export default MyApp;
