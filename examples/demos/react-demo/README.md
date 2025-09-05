# React Demo with Nhost SDK

This demo application showcases how to use the Nhost SDK with React.

## Features

- Authentication (Sign up, Sign in, Sign out)
- Protected routes with centralized authentication checks
- Multi-factor Authentication (MFA) with TOTP
- File uploads and management
- User profile management
- Password change functionality

## Project Structure

- `/src/components` - Reusable UI components
- `/src/lib/nhost` - Nhost SDK configuration and hooks
- `/src/pages` - Application pages/routes
- `/src/utils` - Utility functions

## Authentication Flow

The application uses the `AuthProvider` from `/src/lib/nhost/AuthProvider.tsx` to manage authentication state and provide the Nhost client to all components.

### Protected Routes

The application uses a `ProtectedRoute` component (in `/src/components/ProtectedRoute.tsx`) as a layout route to handle authentication checks in a centralized way. This component:

1. Checks if the user is authenticated
2. Shows a loading state when authentication status is being determined
3. Redirects to the sign-in page if not authenticated
4. Renders the child routes using React Router's `Outlet` component

Usage in `App.tsx`:

```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/profile" element={<Profile />} />
  <Route path="/upload" element={<Upload />} />
  <Route path="/verify" element={<Verify />} />
</Route>
```

This approach leverages React Router's layout routes feature to apply authentication protection to multiple routes without repeating code. It eliminates the need to add authentication checks in each protected page component.

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

- `VITE_NHOST_REGION` - Your Nhost region (e.g., "eu-central-1")
- `VITE_NHOST_SUBDOMAIN` - Your Nhost subdomain
- `VITE_ENV` - Environment (e.g., "development", "production")
