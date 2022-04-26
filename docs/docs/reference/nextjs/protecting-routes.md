---
title: 'Protecting routes'
sidebar_position: 3
---

Create an `auth-protected.js` file:

```jsx
import { useRouter } from 'next/router';
import { useAuthenticationStatus } from '@nhost/nextjs';

export function authProtected(Comp) {
  return function AuthProtected(props) {
    const router = useRouter();
    const { isLoading, isAuthenticated } = useAuthenticationStatus();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return null;
    }

    return <Comp {...props} />;
  };
}
```

Then wrap the Next.js page with `authProtected` to only allow signed in users to access the page.

```js
import { authProtected } from '<some-path>/auth-protected';

function Index() {
  return <div>Only signed in users can access this page.</div>;
}

export default authProtected(Index);
```
