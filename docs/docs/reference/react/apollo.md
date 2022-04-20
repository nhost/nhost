---
title: 'Apollo GraphQL'
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Installation

<Tabs>
  <TabItem value="npm" label="npm" default>

```bash
npm install @nhost/react @nhost/react-apollo @apollo/client graphql
```

  </TabItem>
  <TabItem value="yarn" label="Yarn">

```bash
yarn add @nhost/react @nhost/react-apollo @apollo/client graphql
```

  </TabItem>
</Tabs>

## Configuration

Let's add a `NhostApolloProvider`. Make sure the Apollo Provider is nested into `NhostReactProvider`, as it will need the Nhost context to determine the authentication headers to be sent to the GraphQL endpoint.

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { NhostClient, NhostReactProvider } from '@nhost/react';

const nhost = new NhostClient({
  backendUrl: 'http://localhost:1337',
});

ReactDOM.render(
  <React.StrictMode>
    <NhostReactProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <App />
      </NhostApolloProvider>
    </NhostReactProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
```

## Usage

All the [Apollo hooks](https://www.apollographql.com/docs/react/api/react/hooks/) will work together with the right authentication status, for any operation - queries, mutations, and subscriptions over websockets.

As an example:

```jsx
import { gql, useQuery } from '@apollo/client';
import { useAuthenticated } from '@nhost/react';

const GET_BOOKS = gql`
  query Books {
    books {
      id
      name
    }
  }
`;

export const BooksQuery = () => {
  const isAuthenticated = useAuthenticated();
  const { loading, data, error } = useQuery(GET_BOOKS);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>You must be authenticated to see this page</div>;
  }

  if (error) {
    return <div>Error in the query {error.message}</div>;
  }

  return (
    <div>
      <ul>
        {data?.books.map((book) => (
          <li key={book.id}>{book.name}</li>
        ))}
      </ul>
    </div>
  );
};
```

## Hooks

### `useAuthQuery`

Works exactly as the original Apollo's [`useQuery`](https://www.apollographql.com/docs/react/api/react/hooks/#usequery) except the query will be skipped if the user is not authenticated.

---

## Read more

More information about the dependent packages:

- [`@apollo/client`](https://www.npmjs.com/package/@apollo/client)
- [`graphql`](https://www.npmjs.com/package/graphql)
