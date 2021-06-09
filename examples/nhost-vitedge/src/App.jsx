import './App.css'
import React, { useState } from 'react'
import { Link, Route, Switch } from 'react-router-dom'
import logo from './logo.svg'

import { NhostApolloProvider } from '@nhost/react-apollo'
import { NhostAuthProvider } from '@nhost/react-auth'

import { auth } from './utils/nhost'

export default function App({ router }) {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <NhostAuthProvider auth={auth}>
        <NhostApolloProvider
          auth={auth}
          gqlEndpoint={import.meta.env.VITE_GRAPHQL_ENDPOINT}
        >
          <Switch>
            {router.routes.map((route) => {
              return (
                <Route exact key={route.path} path={route.path}>
                  <route.component />
                </Route>
              )
            })}
          </Switch>
        </NhostApolloProvider>
      </NhostAuthProvider>
    </div>
  )
}
