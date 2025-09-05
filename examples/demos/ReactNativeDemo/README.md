# Nhost SDK Demo - React Native

This is a comprehensive React Native demo showcasing the Nhost SDK integration with Expo. The application demonstrates various authentication methods, user management, file operations, and GraphQL interactions in a modern React Native environment.

## Features

- **Email/Password Authentication** - Traditional sign-up and sign-in with email
- **Multi-Factor Authentication (MFA)** - TOTP-based 2FA security
- **Magic Link Authentication** - Passwordless authentication via email
- **Social Authentication** - GitHub OAuth integration
- **Native Authentication** - Apple Sign-In for iOS devices
- **User Profile Management** - Display and manage user information
- **Protected Routes** - Route-based authentication guards
- **Session Persistence** - Reliable session storage with AsyncStorage
- **File Operations** - Upload and download functionality
- **GraphQL Operations** - Database queries and mutations

## Quick Start

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure Nhost**

   Update `app.json` with your Nhost configuration:

   ```json
   "extra": {
     "NHOST_SUBDOMAIN": "your-subdomain",
     "NHOST_REGION": "your-region"
   }
   ```

   For local development with Nhost CLI:

   ```json
   "extra": {
     "NHOST_SUBDOMAIN": "192-168-1-103",
     "NHOST_REGION": "local"
   }
   ```

   _(Replace with your actual local IP address using hyphens instead of dots)_

3. **Start the development server**

   ```bash
   pnpm start
   ```

4. **Open the app**
   - Scan QR code with Expo Go
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator

## Project Structure

The project uses [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation:

```
ReactNativeWebDemo/
├── app/
│   ├── _layout.tsx              # Root layout with AuthProvider
│   ├── index.tsx                # Home/landing screen
│   ├── signin.tsx               # Authentication hub with tabs
│   ├── signup.tsx               # User registration
│   ├── profile.tsx              # Protected user profile
│   ├── upload.tsx               # File upload demo
│   ├── verify.tsx               # Magic link/social auth verification
│   │
│   ├── components/
│   │   ├── ProtectedScreen.tsx  # Route protection wrapper
│   │   ├── MagicLinkForm.tsx    # Magic link authentication
│   │   ├── SocialLoginForm.tsx  # GitHub OAuth
│   │   ├── NativeLoginForm.tsx  # Native auth container
│   │   ├── AppleSignIn.tsx      # Apple Sign-In (iOS)
│   │   └── MFASettings.tsx      # Multi-factor authentication
│   │
│   └── lib/
│       ├── nhost/
│       │   ├── AuthProvider.tsx     # Authentication context
│       │   └── AsyncStorage.tsx     # Session persistence adapter
│       └── utils.ts                 # Utility functions
│
├── assets/                      # App icons and images
├── app.json                     # Expo configuration
└── README files                 # Documentation (this file and others)
```

## Architecture Overview

### Authentication Flow

1. **AuthProvider** wraps the entire app providing global auth state
2. **ProtectedScreen** component guards routes requiring authentication
3. **Session persistence** maintains login state across app restarts
4. **Deep linking** handles magic links and OAuth redirects

### Key Components

- **AuthProvider**: Central authentication state management
- **ProtectedScreen**: Higher-order component for route protection
- **Verification flows**: Unified handling for magic links and OAuth callbacks
- **Storage adapter**: Custom AsyncStorage implementation for session persistence

### Supported Authentication Methods

1. **Email/Password**: Traditional username/password with MFA support
2. **Magic Links**: Passwordless authentication via email verification
3. **Social OAuth**: GitHub integration with redirect handling
4. **Native Authentication**: Apple Sign-In using secure enclave

## Configuration

### Environment Variables

Set these values in `app.json` under the `extra` section:

| Variable          | Description                  | Example       |
| ----------------- | ---------------------------- | ------------- |
| `NHOST_SUBDOMAIN` | Your Nhost project subdomain | `"myproject"` |
| `NHOST_REGION`    | Nhost region                 | `"us-east-1"` |

### Deep Linking Setup

The app is configured with the scheme `reactnativewebdemo://` for standalone builds and uses Expo's linking system for development.

## Development

### Local Nhost Backend

To run against a local Nhost backend:

1. Start Nhost CLI:

   ```bash
   nhost dev
   ```

2. Update `app.json`:
   ```json
   "extra": {
     "NHOST_REGION": "local",
     "NHOST_SUBDOMAIN": "local"
   }
   ```

### Testing Authentication

- Use the sign-in screen's tabbed interface to test different auth methods
- Magic links work in development through proper deep link configuration
- Social authentication requires OAuth app setup in your Nhost dashboard

## Documentation

- [Protected Routes & Email Auth](./README_PROTECTED_ROUTES.md)
- [Native Authentication](./README_NATIVE_AUTHENTICATION.md)
- [Magic Links](./README_MAGIC_LINKS.md)
- [Social Sign-In](./README_SOCIAL_SIGNIN.md)

## Learn More

- [Nhost Documentation](https://docs.nhost.io/)
- [Expo Router Documentation](https://docs.expo.dev/router/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
