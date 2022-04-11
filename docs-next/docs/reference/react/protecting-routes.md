---
title: 'Protecting routes'
sidebar_position: 3
---

## React Router

You can protect routes by creating an `AuthGate` component when using `@nhost/react` with [React Router](https://reactrouter.com/web/guides/quick-start).

```jsx
import { useAuthenticationStatus } from '@nhost/react';
import { Redirect } from 'react-router-dom';

export function AuthGate({ children }) {
  const { isLoading, isAuthenticated } = useAuthenticationStatus();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return children;
}
```

Then, in your React Router, wrap the `AuthGate` component around the routes you want to protect:

```jsx
import { AuthGate } from 'components/AuthGate';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login">
          <Login />
        </Route>

        <Route path="/" exact>
          {/* Use AuthGate component like this */}
          <AuthGate>
            <div>My protected dashboard</div>
          </AuthGate>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```
