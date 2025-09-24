# Magic Links Authentication

This document explains how magic links (passwordless authentication) are implemented in the Nhost React Native demo, including deep linking configuration, verification endpoints, and testing strategies.

## Overview

Magic links provide a passwordless authentication method where users receive an email containing a link that automatically authenticates them when clicked. This implementation handles both Expo Go development and standalone app scenarios.

## How Magic Links Work

### Authentication Flow

1. **Email Collection**: User enters their email address
2. **Link Generation**: App requests magic link from Nhost with appropriate redirect URL
3. **Email Delivery**: Nhost sends email with authentication link
4. **Link Click**: User clicks link, which opens the app via deep linking
5. **Token Extraction**: App extracts refresh token from the URL parameters
6. **Authentication**: App uses refresh token to authenticate with Nhost
7. **Redirect**: User is redirected to their profile upon successful authentication

## Implementation Details

### MagicLinkForm Component

```typescript
// app/components/MagicLinkForm.tsx
export default function MagicLinkForm() {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const { nhost } = useAuth();

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create the correct redirect URL for current environment
      const redirectUrl = Linking.createURL("verify");

      await nhost.auth.signInPasswordlessEmail({
        email,
        options: {
          redirectTo: redirectUrl,
        },
      });

      setSuccess(true);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(
        `An error occurred while sending the magic link: ${error.message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ... UI implementation
}
```

### Key Features

1. **Environment Detection**: Automatically generates correct redirect URLs for Expo Go vs standalone
2. **Error Handling**: Comprehensive error handling with user-friendly messages
3. **Loading States**: Visual feedback during magic link generation
4. **Success Feedback**: Confirmation when magic link is sent

## Deep Linking Configuration

### App Configuration

The app supports deep linking through custom URL schemes:

```json
// app.json
{
  "expo": {
    "scheme": "reactnativewebdemo",
    "ios": {
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": ["reactnativewebdemo"]
          }
        ]
      }
    }
  }
}
```

### URL Format Differences

#### Standalone App

```
reactnativewebdemo://verify?refreshToken=abc123...
```

#### Expo Go Development

```
exp://192.168.1.103:19000/--/verify?refreshToken=abc123...
```

### Dynamic URL Generation

```typescript
// Automatically creates correct URL format for current environment
const redirectUrl = Linking.createURL("verify");

// In Expo Go: exp://192.168.1.103:19000/--/verify
// In standalone: reactnativewebdemo://verify
```

## Verification Endpoint

### Verify Screen Implementation

```typescript
// app/verify.tsx
export default function Verify() {
  const params = useLocalSearchParams<{ refreshToken: string }>();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const { nhost, isAuthenticated } = useAuth();

  useEffect(() => {
    const refreshToken = params.refreshToken;

    if (!refreshToken) {
      setStatus("error");
      setError("No refresh token found in the link");
      return;
    }

    async function processToken(): Promise<void> {
      try {
        // Brief delay to show verifying state
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Authenticate using the refresh token
        await nhost.auth.refreshToken({ refreshToken });

        setStatus("success");

        // Redirect to profile after brief success message
        setTimeout(() => {
          router.replace("/profile");
        }, 1500);
      } catch (err) {
        setStatus("error");
        setError(`Authentication failed: ${err.message}`);
      }
    }

    processToken();
  }, [params, nhost.auth]);

  // ... UI implementation for different states
}
```

### Verification States

1. **Verifying**: Shows loading spinner while processing token
2. **Success**: Displays success message before redirect
3. **Error**: Shows error details and debugging information

## URL Parameter Handling

### Token Extraction

The verify screen extracts authentication parameters from the URL:

```typescript
// Extract refresh token from URL parameters
const params = useLocalSearchParams<{ refreshToken: string }>();
const refreshToken = params.refreshToken;

// Validate token presence
if (!refreshToken) {
  setStatus("error");
  setError("No refresh token found in the link");
  return;
}
```

### Debug Information

For development, the verify screen can display all received parameters:

```typescript
// Debug: Show all URL parameters (development only)
if (__DEV__) {
  const allParams: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") {
      allParams[key] = value;
    }
  });
  console.log("Received URL parameters:", allParams);
}
```

## Testing Magic Links

### Development with Expo Go

1. **Start Development Server**:

   ```bash
   npx expo start
   ```

2. **Note Your Local URL**:

   - Check terminal output for development URL (e.g., `exp://192.168.1.103:19000`)

3. **Send Magic Link**:

   - Use Magic Link form in the app
   - Enter your email address
   - Submit the form

4. **Check Email Format**:

   - Magic link should use format: `exp://192.168.1.103:19000/--/verify?refreshToken=...`
   - The `--` segment is crucial for Expo Go routing

5. **Test the Link**:
   - Open email on device with Expo Go installed
   - Tap the magic link
   - Should open directly in Expo Go

### Testing Strategies

#### Manual Testing

```typescript
// Test different scenarios
const testScenarios = [
  "Valid magic link with correct token",
  "Expired magic link",
  "Invalid refresh token",
  "Malformed URL parameters",
  "Network connectivity issues",
  "Already authenticated user",
];
```

#### Automated URL Testing

```typescript
// Manually test URL handling
const testUrls = [
  "exp://192.168.1.103:19000/--/verify?refreshToken=valid_token",
  "exp://192.168.1.103:19000/--/verify?refreshToken=invalid_token",
  "exp://192.168.1.103:19000/--/verify", // Missing token
];
```

## Environment-Specific Considerations

### Expo Go Limitations

1. **URL Format**: Must use `exp://` protocol with development server URL
2. **Port Changes**: URL changes if development server restarts on different port
3. **Network Dependency**: Requires same network for device and development machine
4. **Debug Access**: Can inspect URL parameters more easily

### Standalone App Benefits

1. **Custom Scheme**: Uses app's custom URL scheme (`reactnativewebdemo://`)
2. **Universal Links**: Can configure universal links for production
3. **App Store Distribution**: Works with published apps
4. **Offline Capability**: Less dependent on development server

## Security Considerations

### Token Security

1. **Short-Lived Tokens**: Refresh tokens have limited lifespan
2. **Single Use**: Tokens are invalidated after successful authentication
3. **Secure Transport**: Links are sent via secure email delivery
4. **Validation**: Server-side token validation prevents tampering

### Best Practices

```typescript
// Implement proper error handling
const processToken = async (token: string) => {
  try {
    // Validate token format before sending to server
    if (!token || token.length < 10) {
      throw new Error("Invalid token format");
    }

    // Use the token
    await nhost.auth.refreshToken({ refreshToken: token });
  } catch (error) {
    // Log error for debugging but don't expose details to user
    console.error("Magic link authentication failed:", error);
    throw new Error("Authentication failed. Please try again.");
  }
};
```

## Troubleshooting

### Common Issues

| Issue                              | Symptom                                 | Solution                                                      |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| Link doesn't open app              | Clicking link opens browser instead     | Check URL scheme configuration and Expo Go installation       |
| "No refresh token" error           | Link opens app but shows error          | Verify email contains correct URL format with parameters      |
| Network errors during verification | Authentication fails with network error | Check Nhost configuration and internet connectivity           |
| Wrong URL format in email          | Link uses incorrect protocol or format  | Verify `Linking.createURL()` usage and development server URL |

### Debug Steps

1. **Check Console Logs**:

   ```typescript
   console.log("Generated redirect URL:", redirectUrl);
   console.log("Received URL parameters:", params);
   ```

2. **Verify Email Content**:

   - Check that email contains correct URL format
   - Ensure refresh token parameter is present

3. **Test URL Manually**:

   - Copy magic link from email
   - Paste into browser or use device's URL handler

4. **Network Debugging**:
   - Ensure device and development machine are on same network
   - Check firewall settings

### Expo Go Specific Debugging

```typescript
// Debug Expo Go URLs
if (__DEV__) {
  const expoUrl = Linking.createURL("verify");
  console.log("Expo Go URL format:", expoUrl);

  // Should output something like:
  // exp://192.168.1.103:19000/--/verify
}
```

## Production Deployment

### Universal Links (iOS)

For production iOS apps, configure universal links:

```json
// apple-app-site-association
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.nhost.reactnativewebdemo",
        "paths": ["/verify*"]
      }
    ]
  }
}
```

### App Links (Android)

Configure Android app links for seamless user experience:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity android:name=".MainActivity">
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
          android:host="yourapp.com"
          android:pathPrefix="/verify" />
  </intent-filter>
</activity>
```

## Related Documentation

- [Protected Routes & Email Auth](./README_PROTECTED_ROUTES.md)
- [Native Authentication](./README_NATIVE_AUTHENTICATION.md)
- [Social Sign-In](./README_SOCIAL_SIGNIN.md)

## External Resources

- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)
- [Nhost Passwordless Authentication](https://docs.nhost.io/authentication/passwordless)
- [Universal Links (iOS)](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
