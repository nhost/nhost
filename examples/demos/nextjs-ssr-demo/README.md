# Next.js SSR Demo with Nhost

This project demonstrates how to integrate Nhost with Next.js, showcasing server-side rendering (SSR) capabilities and authentication flows. It includes features like file uploads, session management, middleware for route protection, and client-side interactions for interactive components.

## Getting Started

To run the demo locally:

1. Clone this repository
2. Start the Nhost backend:

```bash
cd backend
nhost up
```

3. Start the Next.js application:

```bash
cd demos/nextjs-ssr-demo
pnpm install
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Environment Configuration

The application uses the following environment variables:

- `NHOST_REGION` - The region where your Nhost project is located (defaults to "local")
- `NHOST_SUBDOMAIN` - The subdomain of your Nhost project (defaults to "local")

## Nhost SDK Integration

This project demonstrates how to effectively use the Nhost SDK with Next.js in a server-side rendering (SSR) setup. Most of the application is built using server components, which allows for better performance and SEO. Most of the code is either generic Next.js code or vanilla Nhost code.

### Server and Client Components

The special integration code needed to handle server + client components and the Next.js middleware can be found under:

- `src/app/lib/nhost/client/index.tsx` - This file exports:
  - `createNhostClient` initializes an Nhost client using CookieStorage to be used in client components.
- `src/app/lib/nhost/server/index.tsx` - This file exports:
  - `createNhostClient` initializes an Nhost client using CookieStorage to be used in server components.
  - `handleNhostMiddleware` handles the initialization of an Nhost client that can be used in Next.js middleware and refreshes the session if needed.
- `src/app/lib/nhost/AuthProvider.tsx` - This file provides:
  - Client-side authentication context with session state management
  - Cross-tab session synchronization using `sessionStorage.onChange`
  - Refresh token change detection for middleware-driven session updates
  - Page visibility and focus event handling for session state consistency

The key differences in the implementation:

- **Client Components**

  - Uses `CookieStorage` for persistent session management
  - Enables client-side operations like file uploads and MFA configuration
  - Provides authentication context with cross-tab session synchronization
  - Handles session state changes from middleware and other tabs

- **Server Components**
  - Custom storage implementation utilizing cookies compatible with Next.js server components
  - Disables auto-refresh token feature as server components can't write cookies
  - Supports server-side data fetching and rendering

### Cookie-Based Session Persistence

A key aspect of this integration is how the session is persisted across server and client components:

- Both server and client components use cookie-based storage
- The server implementation reads cookies using Next.js's `cookies()` API
- The middleware implementation has its own cookie handling to read from request cookies and write to response cookies
- The session is stored using the default session key from the SDK (`nhostSession`)
- The refresh token mechanism is handled by the middleware to ensure session continuity
- Client-side AuthProvider synchronizes session state across tabs and detects middleware-driven session changes
- Cross-tab session expiration is handled by monitoring `sessionStorage.onChange` events

### Middleware for Route Protection

The middleware (`src/middleware.ts`) is used to protect routes and handle refreshing the tokens. It handles:

- Route protection for authenticated pages
- Session token refreshing
- Redirecting unauthenticated users to the sign-in page

Public routes (like `/signin`, `/signup`, and `/verify`) are explicitly allowed without authentication.

### Authentication Features

All authentication steps are performed server-side and rely on the vanilla nhost-js SDK. No special code or considerations are needed for this. The demo supports multiple authentication methods, including:

- Email and Password with optional MFA
- Magic Link authentication

You can find all the relevant code in the folders:

- `src/app/signin/` - Sign in methods
- `src/app/signup/` - Sign up methods
- `src/app/verify/` - Route to verify the magic link. We use a route because server components are not allowed to write cookies. Alternatively, this could be done on a client component as those are allowed to write cookies, but we wanted to keep the sign-in flow as server components for demonstration purposes.

### Profile Management

The profile page is a server component that fetches the session data from the persisted session cookie. In addition, the profile page allows users to configure their MFA.

There are three peculiarities with the profile page:

1. The session is read on the server from the cookie so the profile can be rendered server-side.
2. The MFA configuration is done using a client component to provide interactivity.
3. Similarly, changing the password is done client-side.

You can find all the relevant code in the folder:

- `src/app/profile/`

### GraphQL Integration

The application demonstrates how to use Nhost's GraphQL client in both server and client components.

### File Storage Implementation

The application demonstrates how to use Nhost's file storage capabilities. While the `/upload` page is fully pre-rendered server-side, all interactions in this page are handled by client components. This allows the user to upload/download files directly to the storage service.

Some details about the page:

1. The page is fully rendered server-side, including the list of files, which are retrieved using GraphQL.
2. All the storage interactions (uploading, downloading, deleting) are handled by client components.
3. The download is done by using authenticated requests. This requires a bit of post-processing as we need to fetch the file with the SDK and then create a blob URL to download the file but it is much more efficient than presigned URLs as we can leverage the CDN for caching.
4. To avoid re-fetching the list of files on every interaction, we push/remove the file to/from the list of files in the client component. This is done using a custom hook that uses the `useState` and `useEffect` hooks to manage the state of the files.

You can find the code for the `/upload` page in the folder:

- `src/app/upload/`

### Layout and Navigation

The layout is a server component that will render different content depending on the authentication state of the user:

- If the user is authenticated, the layout will render the navigation bar with the profile and upload links.
- If the user is not authenticated, the layout will render the sign in and sign up links.

To make sure the navigation is always up to date, every server component that changes the authentication state will call `revalidateAfterAuthChange` to revalidate the layout. This is done using the `revalidatePath` function from Next.js.

## Development Tooling

This demo uses:

- Next.js 15 with App Router
- Turbopack for faster development experience (via `--turbopack` flag)
- TypeScript for type safety
- React 19

## Key Nhost SDK Features Used

- **Authentication** - Sign in/up, Magic Links, MFA
- **GraphQL** - Data fetching for files and user information
- **Storage** - File uploads and downloads
- **Cookies** - Session persistence across server and client components
- **Middleware Integration** - Seamless route protection

## Learn More

- [Nhost Documentation](https://docs.nhost.io)
- [Next.js Documentation](https://nextjs.org/docs)
