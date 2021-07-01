import React from 'react';
import ReactDOM from 'react-dom';
import { NhostApolloProvider } from "@nhost/react-apollo";
import { NhostAuthProvider } from "@nhost/react-auth";
import { auth } from "./utils/nhost";
import { App } from './App';

const root = document.getElementById("root");

ReactDOM.render(
  <React.StrictMode>
    <NhostAuthProvider auth={auth}>
      <NhostApolloProvider
        auth={auth}
        gqlEndpoint="https://hasura-YOUR_GRAPHQL_API.nhost.app/v1/graphql"
      >
        <App />
      </NhostApolloProvider>
    </NhostAuthProvider>
  </React.StrictMode>, root
);
