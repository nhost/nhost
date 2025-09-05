# SvelteKit Demo with Nhost SDK

This demo application showcases how to use the Nhost SDK with SvelteKit.

## Features

- Authentication (Sign up, Sign in, Sign out)
- Protected routes with authentication state management
- Multi-factor Authentication (MFA) with TOTP
- File uploads and management
- User profile management
- Password change functionality
- Magic link authentication
- Social authentication (GitHub)
- WebAuthn/Passkeys support
- Security keys management

## Project Structure

- `/src/lib/components` - Reusable UI components
- `/src/lib/nhost` - Nhost SDK configuration and authentication store
- `/src/routes` - SvelteKit routes and pages
- `/src/lib/utils.ts` - Utility functions

## Authentication Flow

The application uses SvelteKit's reactive state management with the Nhost client configured in `/src/lib/nhost/auth.ts`. The auth store provides reactive authentication state throughout the application.

### Protected Routes

The application handles authentication protection directly in route components using SvelteKit's reactive `$effect` blocks. Each protected route:

1. Checks the authentication state using the `$auth` store
2. Shows a loading state when authentication status is being determined
3. Redirects to the sign-in page if not authenticated
4. Renders the protected content when authenticated

Example from a protected route:

```svelte
<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/nhost/auth";

  // Redirect if not authenticated
  $effect(() => {
    if (!$auth.isLoading && !$auth.isAuthenticated) {
      goto("/signin");
    }
  });
</script>

{#if $auth.isLoading}
  <div class="loading-container">Loading...</div>
{:else if $auth.isAuthenticated}
  <!-- Protected content -->
{:else}
  <div class="text-center">
    <h2 class="text-xl mb-4">Access Denied</h2>
    <p>You must be signed in to view this page.</p>
  </div>
{/if}
```

This approach leverages SvelteKit's reactive state system to provide seamless authentication protection while maintaining clean, readable code.

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

## SvelteKit-Specific Features

### Reactive Authentication State

The application uses SvelteKit's `$state` runes and reactive stores to manage authentication state, providing automatic UI updates when authentication status changes.

### Route-based Navigation

SvelteKit's file-based routing system is used with the following structure:

- `/routes/+page.svelte` - Home page
- `/routes/signin/+page.svelte` - Sign in page
- `/routes/signin/mfa/+page.svelte` - MFA verification page
- `/routes/signup/+page.svelte` - Sign up page
- `/routes/profile/+page.svelte` - Protected profile page
- `/routes/upload/+page.svelte` - Protected file upload page
- `/routes/verify/+page.svelte` - Email verification page

### Component Architecture

Components use SvelteKit's latest features including:

- `$props()` for component properties
- `$state()` for reactive local state
- `$effect()` for side effects and lifecycle management
- `{#snippet}` for reusable template blocks
