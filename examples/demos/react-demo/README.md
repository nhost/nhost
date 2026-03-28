# React Demo with Nhost SDK

This demo application showcases how to use the Nhost SDK with React.

## Features

- **Authentication** — Sign up, sign in, and sign out with multiple methods (email/password, magic link, GitHub OAuth, WebAuthn)
- **Multi-factor Authentication** — TOTP-based MFA and WebAuthn security keys
- **Protected routes** — Centralized authentication checks using layout routes
- **User profile management** — Display name, email, roles, session info, password change
- **Todo management** — Full CRUD with GraphQL backend
- **File uploads** — Upload, view, replace, delete files with presigned URL support and image transformations
- **Communities** — Join communities, share and manage files within them
- **Serverless functions** — Testing interface for various function patterns (echo, error handling, JWT verification, CORS, SDK queries)
- **OAuth2 client management** — Create, edit, and delete OAuth2 clients with redirect URIs, scopes, and secret management
- **OAuth2 consent page** — Authorization consent flow for third-party applications

## Project Structure

- `/src/components` — Reusable UI components (navigation, auth forms, MFA settings, WebAuthn, etc.)
- `/src/lib/nhost` — Nhost SDK configuration and hooks
- `/src/pages` — Application pages/routes
- `/src/utils` — Utility functions

## Routes

### Public Routes

| Path | Description |
|------|-------------|
| `/` | Home — redirects based on authentication status |
| `/signin` | Sign in with email/password, magic link, GitHub OAuth, or WebAuthn |
| `/signin/mfa` | MFA verification |
| `/signup` | Sign up with multiple methods |
| `/verify` | Email verification callback |
| `/oauth2/consent` | OAuth2 authorization consent page |

### Protected Routes (require authentication)

| Path | Description |
|------|-------------|
| `/profile` | User profile, session info, MFA settings, security keys, password change |
| `/todos` | Todo list management (CRUD) |
| `/upload` | File upload and management |
| `/communities` | Community management with file sharing |
| `/functions` | Serverless functions testing interface |
| `/oauth2-providers` | OAuth2 client administration |

## Authentication Flow

The application uses the `AuthProvider` from `/src/lib/nhost/AuthProvider.tsx` to manage authentication state and provide the Nhost client to all components.

### Protected Routes

The application uses a `ProtectedRoute` component (in `/src/components/ProtectedRoute.tsx`) as a layout route to handle authentication checks in a centralized way. This component:

1. Checks if the user is authenticated
2. Shows a loading state when authentication status is being determined
3. Redirects to the sign-in page if not authenticated
4. Renders the child routes using React Router's `Outlet` component

### Sign-in Methods

- **Email/password** — Traditional credentials-based authentication
- **Magic link** — Passwordless email-based authentication
- **GitHub OAuth** — Social login via GitHub
- **WebAuthn** — Passwordless authentication with security keys or biometrics

## OAuth2

### Consent Page (`/oauth2/consent`)

Handles the OAuth2 authorization flow for third-party applications. Displays the requesting application name (derived from the redirect URI), requested scopes, and the current user's email. Unauthenticated users are redirected to sign in first.

### Client Management (`/oauth2-providers`)

Admin interface for managing OAuth2 clients:

- Create new clients with redirect URIs and scopes
- Edit existing client configurations
- Delete clients
- Regenerate client secrets (displayed once upon creation)
- Scopes are dynamically fetched from the OpenID configuration

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   pnpm install
   ```
3. Configure your Nhost environment variables in `.env` file
4. Start the development server:
   ```
   pnpm dev
   ```

## Environment Variables

The application requires the following environment variables:

- `VITE_NHOST_REGION` — Your Nhost region (e.g., "eu-central-1")
- `VITE_NHOST_SUBDOMAIN` — Your Nhost subdomain
- `VITE_ENV` — Environment (e.g., "development", "production")
