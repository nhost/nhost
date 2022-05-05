---
title: Protecting routes
sidebar_position: 2
---

## React Router

:::info
This example uses the latest version of [React Router (v6)](https://reactrouter.com/docs/en/v6).
:::

You can protect routes by creating a wrapper component (`ProtectedRoute`) to implement the authentication logic using `@nhost/react`.

```jsx
// src/components/ProtectedRoute.js

import { useAuthenticationStatus } from '@nhost/react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus()
  const location = useLocation()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  return <Outlet />
}

export default ProtectedRoute
```

So, if the user is not authenticated, we redirect him to the `/login` route using the [`Navigate`](https://reactrouter.com/docs/en/v6/api#navigate) component of React Router. Otherwise, we render the [`Outlet`](https://reactrouter.com/docs/en/v6/api#outlet) component, also provided by React Router, to render the `ProtectedRoute` child route elements.

Then, you can use a [layout route](https://reactrouter.com/docs/en/v6/getting-started/concepts#layout-routes) in your `App.js` file to wrap the `ProtectedRoute` component around the routes you want to protect:

```jsx
// src/App.js

import { NhostReactProvider } from '@nhost/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import { nhost } from './lib/nhost'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'

export function App() {
  return (
    <NhostReactProvider nhost={nhost}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </NhostReactProvider>
  )
}
```
