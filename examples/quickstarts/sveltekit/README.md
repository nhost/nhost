# Using Nhost with SvelteKit quickstart

This is a quickstart that showcases how to use the Nhost SDK running on server `load` functions and API routes that run exclusively on the server.

## Authentication

1. **Saving the auth session**

   In order to utilize the Nhost SDK with an authenticated session on the server, it is necessary to securely store this session within a cookie. This should be done right after any **signIn** or **signUp** operation. See example [here](https://github.com/nhost/nhost/blob/main/examples/quickstarts/sveltekit/src/routes/auth/sign-in/email-password/+page.server.js).

2. **Oauth & refresh session server hook**

   Create a server hook `src/hook.server.js` that calls the helper method `manageAuthSession`. Feel free to copy paste the `src/lib/nhost.js` to your project. The second argument for `manageAuthSession` is for handling the case where there's an error refreshing the current session with the `refreshToken` stored in the cookie.

   ```typescript
   import { manageAuthSession } from '$lib/nhost'
   import { redirect } from '@sveltejs/kit'

   /** @type {import('@sveltejs/kit').Handle} */
   export async function handle({ event, resolve }) {
     await manageAuthSession(event, () => {
       throw redirect(303, '/auth/sign-in')
     })

     return resolve(event)
   }
   ```

3. **Protected routes**

   To make sure only authenticated users access certain pages, you need to create a server root layout file `src/routes/+layout.server.js`. Within that file you define your public routes, so any other route would redirect if there's no session.

   ```typescript
    import { getNhost } from '$lib/nhost'
    import { redirect } from '@sveltejs/kit'
    const publicRoutes = [
      '/auth/sign-in',
      '/auth/sign-up',
      ...
    ]

    /** @type {import('./$types').LayoutServerLoad} */
    export async function load({ cookies, route }) {
      const nhost = await getNhost(cookies)
      const session = nhost.auth.getSession()

      if (!publicRoutes.includes(route.id ?? '') && !session) {
        throw redirect(303, '/auth/sign-in')
      }

      return {
        user: session?.user
      }
    }
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
   cd examples/quickstarts/sveltekit
   nhost up
   ```

4. Terminal 2: Start the SvelteKit dev server

   ```sh
   cd examples/quickstarts/sveltekit
   pnpm dev
   ```
