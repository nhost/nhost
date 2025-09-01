# Nhost Vue Demo

This is a Vue.js demonstration of the Nhost SDK, showcasing authentication, user management, and security features.

## Features

This demo includes the following migrated pages and functionality from the React demo:

### Authentication Pages

- **Sign In Page** (`/signin`) - Multi-tab authentication with:
  - Email + Password authentication
  - Magic link authentication
  - Social authentication (GitHub)
  - WebAuthn/Security Key authentication
- **Sign Up Page** (`/signup`) - User registration with the same authentication methods
- **Verify Page** (`/verify`) - Email verification and magic link processing
- **Profile Page** (`/profile`) - Protected user profile management with route guards

### Profile Management Components

- **User Information Display** - Shows user details, roles, and session info
- **Multi-Factor Authentication (MFA) Settings** - Enable/disable TOTP-based MFA
- **Password Management** - Change user password
- **Security Keys Management** - Add/remove WebAuthn security keys

## Technical Stack

- **Vue 3** with Composition API
- **Vue Router 4** for navigation
- **TypeScript** for type safety
- **Vite** for build tooling and development server
- **ESLint** and **Prettier** for code quality and formatting
- **@simplewebauthn/browser** for WebAuthn/FIDO2 authentication
- **Nhost SDK** for backend integration

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the development server:

   ```bash
   pnpm dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/
│   ├── forms/
│   │   ├── TabForm.vue          # Multi-tab form component
│   │   ├── MagicLinkForm.vue    # Magic link authentication
│   │   ├── WebAuthnSignInForm.vue
│   │   └── WebAuthnSignUpForm.vue
│   ├── profile/
│   │   ├── MFASettings.vue      # MFA management
│   │   ├── ChangePassword.vue   # Password change
│   │   └── SecurityKeys.vue     # WebAuthn key management
│   └── Navigation.vue           # Main navigation
├── views/
│   ├── SignIn.vue              # Sign in page
│   ├── SignUp.vue              # Sign up page
│   ├── Verify.vue              # Email verification page
│   └── Profile.vue             # User profile page
├── lib/
│   ├── nhost/
│   │   └── auth.ts             # Auth composable
│   └── utils.ts                # Utility functions
└── router/
    └── index.ts                # Vue Router configuration
```

## Authentication Flow

1. **Sign In/Up**: Users can authenticate using multiple methods
2. **Email Verification**: Magic links and social logins redirect to `/verify` for token processing
3. **Session Management**: Automatic session handling with Nhost
4. **Protected Routes**: Profile page requires authentication
5. **MFA Support**: Optional TOTP-based multi-factor authentication
6. **WebAuthn Support**: Passwordless authentication with security keys

## Styling

The demo uses the same CSS styling as the React version to maintain visual consistency, featuring:

- Dark theme with gradient accents
- Glass-morphism card design
- Responsive layout
- Consistent button and form styling

## Environment Variables

Configure the following in `.env`:

- `VITE_NHOST_REGION` - Nhost region (default: "local")
- `VITE_NHOST_SUBDOMAIN` - Nhost subdomain (default: "local")

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm test` - Run tests, linting, formatting, and audit checks
- `pnpm test:typecheck` - Run TypeScript type checking
- `pnpm test:lint` - Run ESLint
- `pnpm test:format` - Check code formatting with Prettier
- `pnpm test:audit` - Run security audit
- `pnpm format` - Format code with Prettier
