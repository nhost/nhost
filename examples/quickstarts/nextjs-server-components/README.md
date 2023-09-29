# Nhost with Next.js Server Components

This quickstart showcases how to correctly add authentication to a Next.js 13 project using the new App Router and Server Components. The other parts of the SDK (Storage / GraphQL/ Functions) should work the same as before.

## Authentication

1. **Saving the auth session**

   To enable authentication with Server Components we have to store the auth session in a cookie. This should be done right after any **signIn** or **signUp** operation. See example [here](https://github.com/nhost/nhost/blob/main/examples/quickstarts/nextjs-server-components/src/app/server-actions/auth/sign-in-email-password.ts).

2. **Oauth & refresh session middleware**

   Create a middleware at the root of your project that calls the helper method `manageAuthSession`. Feel free to copy paste the the contents of the `/utils` folder to your project. The second argument for `manageAuthSession` is for handling the case where there's an error refreshing the current session with the `refreshToken` stored in the cookie.

   ```typescript
   import { manageAuthSession } from '@utils/nhost'
   import { NextRequest, NextResponse } from 'next/server'

   export async function middleware(request: NextRequest) {
     return manageAuthSession(request, () =>
       NextResponse.redirect(new URL('/auth/sign-in', request.url))
     )
   }
   ```

3. **Protected routes**

   To make sure only authenticated users access some Server Components, wrap them in the Higher Order Server Component `withAuthAsync`.

   ```typescript
   import withAuthAsync from '@utils/auth-guard'

   const MyProtectedServerComponent = async () => {
     return <h2>Protected</h2>
   }

   export default withAuthAsync(MyProtectedServerComponent)
   ```

## Get Started

1. Clone the repository

   ```sh
   git clone https://github.com/nhost/nhost
   cd nhost
   ```

2. Install and build dependencies

   ```sh
   pnpm install
   pnpm build
   ```

3. Terminal 1: Start the Nhost Backend

   > Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli).

   ```sh
   cd examples/quickstarts/nhost-backend
   nhost up
   ```

4. Terminal 2: Start the Next.js application

   ```sh
   cd examples/quickstarts/nextjs-server-components
   pnpm dev
   ```
