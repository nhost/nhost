import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { NhostApolloProvider } from "@nhost/react-apollo";
import { NhostAuthProvider } from "@nhost/react-auth";
import { auth } from "./utils/nhost";

ReactDOM.render(
  <React.StrictMode>
    <NhostAuthProvider auth={auth}>
      <NhostApolloProvider
        auth={auth}
        gqlEndpoint="https://hasura-YOUR_GRAPHQL_API.nhost.app/v1/graphql"
      >

      </NhostApolloProvider>
    </NhostAuthProvider>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
