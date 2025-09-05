# Native Authentication - Apple Sign-In

This document explains how native authentication with Apple Sign-In is implemented in the Nhost React Native demo, including deep linking, nonce generation, ID tokens, and security considerations.

## Overview

Apple Sign-In provides a secure, privacy-focused authentication method for iOS users. The implementation uses cryptographic nonces, identity tokens, and deep linking to ensure a secure authentication flow between the app, Apple's servers, and Nhost.

## Architecture

### Authentication Flow

1. **Nonce Generation**: Create a cryptographic nonce for request verification
2. **Apple Authentication**: Request user authentication from Apple
3. **Identity Token**: Receive signed JWT from Apple containing user information
4. **Nhost Verification**: Send identity token and nonce to Nhost for verification
5. **Session Creation**: Nhost validates the token and creates a user session

## Implementation Details

### Apple Sign-In Component

```typescript
// app/components/AppleSignIn.tsx
const AppleSignIn: React.FC<AppleSignInProps> = ({ setIsLoading }) => {
  const { nhost } = useAuth();
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Check Apple authentication availability
  useEffect(() => {
    const checkAvailability = async () => {
      if (Platform.OS === "ios") {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
      }
    };
    checkAvailability();
  }, []);

  const handleAppleSignIn = async () => {
    try {
      // Generate cryptographic nonce
      const nonce = Math.random().toString(36).substring(2, 15);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      );

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      // Authenticate with Nhost
      if (credential.identityToken) {
        const response = await nhost.auth.signInIdToken({
          provider: "apple",
          idToken: credential.identityToken,
          nonce, // Original unhashed nonce
        });

        if (response.body?.session) {
          router.replace("/profile");
        }
      }
    } catch (error) {
      // Handle authentication errors
    }
  };
};
```

## Security Mechanisms

### Cryptographic Nonce

The nonce prevents replay attacks and ensures request authenticity:

```typescript
// Generate random nonce
const nonce = Math.random().toString(36).substring(2, 15);

// Hash nonce for Apple (SHA256)
const hashedNonce = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  nonce,
);

// Send hashed nonce to Apple
const credential = await AppleAuthentication.signInAsync({
  nonce: hashedNonce,
  // ...
});

// Send original nonce to Nhost for verification
await nhost.auth.signInIdToken({
  provider: "apple",
  idToken: credential.identityToken,
  nonce, // Original unhashed nonce
});
```

### Why Nonce is Important

1. **Replay Attack Prevention**: Ensures each authentication request is unique
2. **Request Binding**: Links the Apple response to the specific app request
3. **Tampering Detection**: Detects if the response has been modified
4. **Time-bound Security**: Nonces typically have short lifespans

### Identity Token Structure

Apple returns a JWT (JSON Web Token) containing:

```json
{
  "iss": "https://appleid.apple.com",
  "aud": "com.nhost.reactnativewebdemo",
  "exp": 1634567890,
  "iat": 1634564290,
  "sub": "000123.abc456def789...",
  "nonce": "hashed_nonce_value",
  "email": "user@example.com",
  "email_verified": "true",
  "real_user_indicator": "true"
}
```

## Platform Requirements

### iOS Configuration

The app must be properly configured for Apple Sign-In:

```json
// app.json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.nhost.reactnativewebdemo",
      "infoPlist": {
        "NSFaceIDUsageDescription": "This app uses Face ID for signing in"
      }
    },
    "plugins": ["expo-apple-authentication"]
  }
}
```

### Availability Check

Apple Sign-In is only available on iOS 13+ devices:

```typescript
const checkAvailability = async () => {
  if (Platform.OS === "ios") {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    setAppleAuthAvailable(isAvailable);
  }
};
```

## Nhost Configuration

### Apple Provider Setup

Configure Apple as an authentication provider in your Nhost dashboard:

1. **Team ID**: Your Apple Developer Team ID
2. **Service ID**: Apple Services ID for your app
3. **Key ID**: Apple Sign-In key identifier
4. **Private Key**: Apple Sign-In private key (P8 file content)

### Server-Side Verification

Nhost performs server-side verification of the identity token:

1. **Signature Verification**: Validates JWT signature using Apple's public keys
2. **Nonce Verification**: Compares hashed nonce in token with provided nonce
3. **Audience Verification**: Ensures token is intended for your app
4. **Expiration Check**: Validates token hasn't expired
5. **Issuer Validation**: Confirms token comes from Apple

## Deep Linking Integration

### URL Scheme Configuration

The app is configured with custom URL schemes for deep linking:

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

### Handling Deep Links

While Apple Sign-In typically doesn't require custom deep linking (it's handled within the app), the configuration supports it for other authentication flows:

```typescript
// app/verify.tsx - Used by other auth methods
useEffect(() => {
  const subscription = Linking.addEventListener("url", handleDeepLink);
  return () => subscription?.remove();
}, []);

const handleDeepLink = (event: { url: string }) => {
  // Handle incoming deep links from authentication providers
};
```

## Error Handling

### Common Apple Sign-In Errors

```typescript
const handleAppleSignIn = async () => {
  try {
    // ... authentication logic
  } catch (error: any) {
    if (error.code === "ERR_CANCELED") {
      // User canceled authentication
      return;
    }

    if (error.code === "ERR_INVALID_RESPONSE") {
      Alert.alert("Error", "Invalid response from Apple");
      return;
    }

    if (error.code === "ERR_NOT_AVAILABLE") {
      Alert.alert("Error", "Apple Sign-In not available on this device");
      return;
    }

    // Generic error handling
    Alert.alert("Authentication Error", error.message || "Unknown error");
  }
};
```

### Nhost Integration Errors

```typescript
const response = await nhost.auth.signInIdToken({
  provider: "apple",
  idToken: credential.identityToken,
  nonce,
});

if (response.error) {
  switch (response.error.message) {
    case "Invalid identity token":
      Alert.alert("Error", "Authentication failed. Please try again.");
      break;
    case "Invalid nonce":
      Alert.alert("Error", "Security verification failed");
      break;
    default:
      Alert.alert("Error", "Authentication error occurred");
  }
}
```

## Privacy Features

### Apple's Privacy Protection

Apple Sign-In provides enhanced privacy features:

1. **Email Relay**: Apple can provide relay emails to protect user's real email
2. **Minimal Data**: Only requests necessary user information
3. **User Control**: Users can choose what information to share
4. **Private Email**: Option to hide real email address

### Handling Private Emails

```typescript
// Handle Apple's private relay emails
const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
  ],
  nonce: hashedNonce,
});

// Email might be a private relay address
console.log("Email:", credential.email); // Could be privaterelay@example.com
```

## Testing

### Development Testing

1. **iOS Simulator**: Apple Sign-In works in iOS Simulator (iOS 14+)
2. **Physical Device**: Test on real iOS devices for complete functionality
3. **Xcode Console**: Monitor authentication flow through Xcode logs

### Test Scenarios

```typescript
// Test different authentication states
const testScenarios = [
  "First-time sign in with Apple ID",
  "Returning user authentication",
  "User cancels authentication",
  "Network connection issues",
  "Invalid Apple ID credentials",
  "Apple ID with 2FA enabled",
];
```

## Security Best Practices

### Implementation Guidelines

1. **Always Use Nonce**: Never skip nonce generation for production apps
2. **Validate Server-Side**: Let Nhost handle token validation
3. **Handle Errors Gracefully**: Provide clear feedback to users
4. **Secure Storage**: Let Nhost handle session storage securely
5. **Regular Updates**: Keep Apple authentication libraries updated

### Production Considerations

1. **Apple Developer Account**: Requires paid Apple Developer membership
2. **App Store Review**: Apple Sign-In must be implemented if other social logins exist
3. **Bundle ID Matching**: Ensure bundle ID matches Apple configuration
4. **Certificate Management**: Keep Apple certificates and keys updated

## Troubleshooting

### Common Issues

| Issue                  | Cause                                    | Solution                                          |
| ---------------------- | ---------------------------------------- | ------------------------------------------------- |
| "Not Available" Error  | iOS version < 13 or not configured       | Check device compatibility and configuration      |
| Invalid Identity Token | Incorrect Nhost Apple configuration      | Verify Apple provider settings in Nhost dashboard |
| Nonce Mismatch         | Sending hashed nonce to Nhost            | Send original unhashed nonce to Nhost             |
| Bundle ID Mismatch     | App bundle ID doesn't match Apple config | Ensure bundle IDs match in all configurations     |

### Debug Tools

```typescript
// Enable debug logging
if (__DEV__) {
  console.log("Apple Auth Available:", appleAuthAvailable);
  console.log("Generated Nonce:", nonce);
  console.log("Hashed Nonce:", hashedNonce);
  console.log("Identity Token:", credential.identityToken);
}
```

## Related Documentation

- [Apple Sign-In Setup Guide](./APPLE_SIGN_IN_SETUP.md)
- [Protected Routes & Email Auth](./README_PROTECTED_ROUTES.md)
- [Magic Links](./README_MAGIC_LINKS.md)
- [Social Sign-In](./README_SOCIAL_SIGNIN.md)

## External Resources

- [Apple Sign-In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Nhost Apple Provider Setup](https://docs.nhost.io/authentication/providers/apple)
- [JWT Token Inspector](https://jwt.io/) - For debugging identity tokens
