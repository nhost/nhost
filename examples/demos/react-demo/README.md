# React Demo with Nhost SDK

This demo application showcases how to use the Nhost SDK with React.

## Features

- **Authentication** — Sign up, sign in, and sign out with multiple methods (email/password, magic link, GitHub OAuth, WebAuthn)
- **Multi-factor Authentication** — TOTP-based MFA and WebAuthn security keys
- **Protected routes** — Centralized authentication checks using layout routes
- **User profile management** — Display name, email, roles, session info, password change
- **Todo management** — Full CRUD with GraphQL backend, stale todo detection (visual indicators and "mark as active" action)
- **File uploads** — Upload, view, replace, delete files with presigned URL support and image transformations
- **Communities** — Join communities, share and manage files within them, inline-edit community descriptions
- **Notifications** — Notification bell with unread count badge, notifications page with mark-as-read and mark-all-as-read, type badges (Community, Todos, Announcement)
- **Event triggers** — Editing a community description triggers a notification to all community members (via Hasura event trigger + serverless function)
- **Cron triggers** — Hourly cron job marks todos older than 7 days as stale and notifies affected users (via Hasura cron trigger + serverless function)
- **One-off scheduled events** — Broadcast notifications to all users, created from the Hasura console (via one-off scheduled event + serverless function)
- **Serverless functions** — Testing interface for various function patterns (echo, error handling, JWT verification, CORS, SDK queries)
- **OAuth2 client management** — Create, edit, and delete OAuth2 clients with redirect URIs, scopes, and secret management
- **OAuth2 consent page** — Authorization consent flow for third-party applications

## Project Structure

- `/src/components` — Reusable UI components (navigation, notification bell, auth forms, MFA settings, WebAuthn, etc.)
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
| `/todos` | Todo list management (CRUD), stale todo indicators |
| `/upload` | File upload and management |
| `/communities` | Community management with file sharing, inline description editing |
| `/notifications` | Notification center with type badges, mark-as-read |
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

## Events & Notifications

This demo showcases Hasura's three event trigger types, all feeding into a shared notifications system.

### Notifications Infrastructure

- `notifications` table stores per-user notifications with a type (`community_update`, `stale_todos`, `announcement`)
- `NotificationBell` component in the nav bar polls for unread count every 30 seconds and on window focus
- `/notifications` page lists all notifications with mark-as-read functionality

### Event Trigger — Community Description Update

When a user edits a community description, a Hasura event trigger fires the `functions/events/community-updated.ts` serverless function. It compares old/new values and inserts a notification for every community member (excluding the editor).

### Cron Trigger — Stale Todo Nudge

A Hasura cron trigger calls `functions/events/stale-todos.ts` on a schedule. The function finds incomplete todos not updated in 7+ days, marks them as `stale`, and creates one grouped notification per affected user. Stale todos display with a visual indicator in the UI and can be marked as active again.

### One-off Scheduled Event — Broadcast Notification

An admin can create a one-off scheduled event from the Hasura console pointing to `functions/events/broadcast-notification.ts`. The function receives a `{ title, message }` payload and inserts a notification for every active user in the system.

### Backend Functions

The serverless functions live in `examples/demos/backend/functions/events/`:

| Function | Trigger Type | Purpose |
|----------|-------------|---------|
| `community-updated.ts` | Event trigger | Notify community members on description change |
| `stale-todos.ts` | Cron trigger | Mark stale todos and notify users |
| `broadcast-notification.ts` | One-off scheduled event | Send announcement to all users |

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
