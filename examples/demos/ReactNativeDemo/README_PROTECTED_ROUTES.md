# Protected Routes & Email Authentication

This document explains how protected routes and email/password authentication are implemented in the Nhost React Native demo, including multi-factor authentication (MFA) support.

## Overview

The app implements a robust authentication system with:

- Email/password sign-up and sign-in
- Route protection for authenticated users
- Multi-factor authentication (MFA) with TOTP
- Persistent session management
- Automatic redirects for unauthenticated users

## Authentication Context

### AuthProvider Implementation

The `AuthProvider` component wraps the entire app and provides global authentication state:

```typescript
// app/lib/nhost/AuthProvider.tsx
const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const nhost = useMemo(() => {
    const subdomain =
      Constants.expoConfig?.extra?.["NHOST_SUBDOMAIN"] || "local";
    const region = Constants.expoConfig?.extra?.["NHOST_REGION"] || "local";

    return createClient({
      subdomain,
      region,
      storage: new NhostAsyncStorage(), // Custom AsyncStorage adapter
    });
  }, []);

  // Session initialization and change listeners...
};
```

### Key Features

1. **Session Persistence**: Uses a custom AsyncStorage adapter that works with Nhost's synchronous interface
2. **Automatic State Updates**: Listens for session changes and updates the global state
3. **Loading States**: Manages loading states during authentication operations
4. **Error Handling**: Graceful handling of storage and authentication errors

## Protected Routes

### ProtectedScreen Component

The `ProtectedScreen` component acts as a higher-order component that protects routes:

```typescript
// app/components/ProtectedScreen.tsx
export default function ProtectedScreen({
  children,
  redirectTo = "/signin",
}: ProtectedScreenProps) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
```

### Usage Example

Protect any screen by wrapping it with `ProtectedScreen`:

```typescript
// app/profile.tsx
export default function Profile() {
  return (
    <ProtectedScreen>
      <ProfileContent />
    </ProtectedScreen>
  );
}
```

### Features

1. **Automatic Redirects**: Unauthenticated users are redirected to sign-in
2. **Loading States**: Shows loading indicator while checking authentication
3. **Customizable Redirect**: Can specify where to redirect unauthenticated users
4. **No Flash**: Prevents showing protected content before redirect

## Email/Password Authentication

### Sign Up Flow

```typescript
// User registration with email and password
const handleSignUp = async () => {
  const { error } = await nhost.auth.signUp({
    email,
    password,
    options: {
      displayName,
    },
  });

  if (!error) {
    // User created successfully
    router.replace("/profile");
  }
};
```

### Sign In Flow

```typescript
// User authentication with email and password
const handleSignIn = async () => {
  const { error, needsEmailVerification, needsMfaOtp } =
    await nhost.auth.signInEmailPassword({
      email,
      password,
    });

  if (needsEmailVerification) {
    setError("Please verify your email before signing in");
    return;
  }

  if (needsMfaOtp) {
    // Redirect to MFA input screen
    setShowMfaInput(true);
    return;
  }

  if (!error) {
    router.replace("/profile");
  }
};
```

## Multi-Factor Authentication (MFA)

### TOTP Setup

The app supports Time-based One-Time Password (TOTP) authentication:

```typescript
// Generate TOTP secret and QR code
const generateMfa = async () => {
  const { totpSecret, qrCodeDataUrl } = await nhost.auth.generateMfa();

  // Display QR code for user to scan with authenticator app
  setQrCode(qrCodeDataUrl);
  setTotpSecret(totpSecret);
};
```

### MFA Verification

```typescript
// Verify TOTP code during sign-in
const verifyMfaCode = async () => {
  const { error } = await nhost.auth.signInMfaTotp({
    otp: mfaCode,
  });

  if (!error) {
    router.replace("/profile");
  }
};
```

### MFA Management

Users can enable/disable MFA from their profile:

```typescript
// Enable MFA with TOTP
const enableMfa = async () => {
  const { error } = await nhost.auth.enableMfa({
    code: totpCode,
  });
};

// Disable MFA
const disableMfa = async () => {
  const { error } = await nhost.auth.disableMfa({
    code: totpCode,
  });
};
```

## Session Management

### Custom AsyncStorage Adapter

The app uses a custom storage adapter for reliable session persistence:

```typescript
// app/lib/nhost/AsyncStorage.tsx
export default class NhostAsyncStorage implements Storage {
  private cache: Map<string, string> = new Map();

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    AsyncStorage.setItem(key, value).catch(console.error);
  }

  getItem(key: string): string | null {
    return this.cache.get(key) || null;
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    AsyncStorage.removeItem(key).catch(console.error);
  }
}
```

### Features

1. **In-Memory Cache**: Provides synchronous access for Nhost while using AsyncStorage
2. **Persistence**: Sessions survive app restarts and background/foreground cycles
3. **Error Handling**: Graceful fallback if AsyncStorage operations fail
4. **Expo Go Compatible**: Works reliably in both Expo Go and standalone builds

## Error Handling

### Common Authentication Errors

```typescript
const handleAuthError = (error: any) => {
  switch (error?.message) {
    case "Invalid email or password":
      setError("Please check your email and password");
      break;
    case "Email not verified":
      setError("Please verify your email before signing in");
      break;
    case "Invalid MFA code":
      setError("Please enter a valid 6-digit code");
      break;
    default:
      setError("An unexpected error occurred");
  }
};
```

### Network and Storage Errors

The app handles various error scenarios:

- Network connectivity issues
- AsyncStorage failures
- Nhost service unavailability
- Invalid authentication tokens

## Security Considerations

### Best Practices Implemented

1. **Secure Storage**: Sessions are stored securely using AsyncStorage
2. **Token Validation**: Automatic token refresh and validation
3. **Route Protection**: Server-side validation of protected routes
4. **MFA Support**: Additional security layer with TOTP
5. **Session Expiry**: Automatic logout when sessions expire

### Password Requirements

Configure password requirements in your Nhost dashboard:

- Minimum length
- Character complexity
- Common password prevention
- Breach database checking

## Testing Authentication

### Test Scenarios

1. **Valid Credentials**: Test successful sign-in with correct email/password
2. **Invalid Credentials**: Test error handling with wrong credentials
3. **Unverified Email**: Test flow for users who haven't verified email
4. **MFA Flow**: Test sign-in with MFA enabled
5. **Session Persistence**: Test app restart with active session
6. **Network Errors**: Test offline scenarios and poor connectivity

### Debug Tools

Enable debug mode to see authentication state changes:

```typescript
// Add to AuthProvider for debugging
useEffect(() => {
  if (__DEV__) {
    console.log("Auth state changed:", { isAuthenticated, user: user?.email });
  }
}, [isAuthenticated, user]);
```

## Configuration

### Required Setup

1. **Email Provider**: Configure email provider in Nhost dashboard
2. **Email Templates**: Customize verification and welcome emails
3. **Password Policy**: Set password requirements
4. **MFA Settings**: Enable TOTP in authentication settings

### Environment Variables

```json
// app.json
{
  "extra": {
    "NHOST_SUBDOMAIN": "your-project-subdomain",
    "NHOST_REGION": "your-region"
  }
}
```

## Troubleshooting

### Common Issues

1. **Session Not Persisting**: Check AsyncStorage permissions and implementation
2. **Infinite Loading**: Verify Nhost configuration and network connectivity
3. **MFA Not Working**: Ensure time synchronization between device and server
4. **Redirect Loops**: Check protected route logic and authentication state

### Debug Steps

1. Check console logs for authentication errors
2. Verify Nhost dashboard configuration
3. Test with simple email/password flow first
4. Gradually add complexity (MFA, protected routes)

## Related Documentation

- [Native Authentication](./README_NATIVE_AUTHENTICATION.md)
- [Magic Links](./README_MAGIC_LINKS.md)
- [Social Sign-In](./README_SOCIAL_SIGNIN.md)
