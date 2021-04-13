import { NhostAuthProvider } from "@nhost/react-auth";
import { NhostApolloProvider } from "@nhost/react-apollo";

import { auth } from "../utils/nhost";

function MyApp({ Component, pageProps }) {
  return (
    <NhostAuthProvider auth={auth}>
      <NhostApolloProvider
        auth={auth}
        gqlEndpoint={process.env.FLAREACT_PUBLIC_GRAPHQL_ENDPOINT}
      >
        <Component {...pageProps} />
      </NhostApolloProvider>
    </NhostAuthProvider>
  );
}

export default MyApp;