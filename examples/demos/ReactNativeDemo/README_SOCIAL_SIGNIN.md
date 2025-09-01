# Social Sign-In with GitHub

This document explains how social authentication with GitHub is implemented in the Nhost React Native demo, including OAuth flow, deep linking, verification endpoints, and configuration requirements.

## Overview

Social sign-in with GitHub provides users with a seamless authentication experience using their existing GitHub accounts. The implementation handles OAuth 2.0 flow, deep linking for mobile apps, and secure token exchange through Nhost's authentication system.

## OAuth 2.0 Flow

### Authentication Process

1. **OAuth Initiation**: App redirects user to GitHub OAuth page
2. **User Authorization**: User grants permissions to the app on GitHub
3. **Authorization Code**: GitHub redirects back with authorization code
4. **Token Exchange**: Nhost exchanges code for access token
5. **User Profile**: Nhost fetches user profile from GitHub
6. **Session Creation**: Nhost creates authenticated session for the user

## Implementation Details

### SocialLoginForm Component

```typescript
// app/components/SocialLoginForm.tsx
export default function SocialLoginForm({
  action,
  isLoading: initialLoading = false,
}: SocialLoginFormProps) {
  const { nhost } = useAuth();
  const [isLoading] = useState(initialLoading);

  const handleSocialLogin = (provider: "github") => {
    // Create redirect URL for current environment
    const redirectUrl = Linking.createURL("verify");

    // Generate OAuth URL with provider and redirect
    const url = nhost.auth.signInProviderURL(provider, {
      redirectTo: redirectUrl,
    });

    // Open GitHub OAuth in system browser
    void Linking.openURL(url);
  };

  return (
    <View style={styles.socialContainer}>
      <Text style={styles.socialText}>
        {action} using your Social account
      </Text>

      <TouchableOpacity
        style={styles.socialButton}
        onPress={() => handleSocialLogin("github")}
        disabled={isLoading}
      >
        <View style={styles.buttonContent}>
          <Ionicons name="logo-github" size={22} style={styles.githubIcon} />
          <Text style={styles.socialButtonText}>Continue with GitHub</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
```

### Key Features

1. **Dynamic URL Generation**: Automatically creates correct redirect URLs for different environments
2. **Provider Flexibility**: Easily extensible to support additional OAuth providers
3. **Visual Feedback**: Loading states and branded buttons for better UX
4. **Error Handling**: Graceful handling of OAuth failures and cancellations

## Deep Linking Configuration

### URL Scheme Setup

The app supports deep linking to handle OAuth redirects:

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

### Redirect URL Formats

#### Standalone App

```
reactnativewebdemo://verify?refreshToken=abc123...&type=signup
```

#### Expo Go Development

```
exp://192.168.1.103:19000/--/verify?refreshToken=abc123...&type=signup
```

### Environment-Aware URL Generation

```typescript
// Automatically handles environment differences
const redirectUrl = Linking.createURL("verify");

// Creates appropriate URL for current environment:
// - Expo Go: exp://host:port/--/verify
// - Standalone: reactnativewebdemo://verify
```

## GitHub OAuth Configuration

### Nhost Dashboard Setup

Configure GitHub as an OAuth provider in your Nhost dashboard:

1. **Provider**: Enable GitHub in Authentication > Providers
2. **Client ID**: GitHub OAuth App Client ID
3. **Client Secret**: GitHub OAuth App Client Secret
4. **Redirect URL**: Configure allowed redirect URLs

### GitHub OAuth App Setup

Create a GitHub OAuth App in your GitHub Developer Settings:

1. **Application Name**: Your app name
2. **Homepage URL**: Your app's homepage
3. **Authorization Callback URL**:
   - Development: `https://local.auth.nhost.run/v1/auth/providers/github/callback`
   - Production: `https://[subdomain].auth.[region].nhost.run/v1/auth/providers/github/callback`

### Required GitHub Scopes

The app requests these GitHub scopes:

- `user:email` - Access to user's email addresses
- `read:user` - Access to user profile information

## Verification Flow

### Verify Screen Implementation

```typescript
// app/verify.tsx - Handles both magic links and social auth
export default function Verify() {
  const params = useLocalSearchParams<{
    refreshToken: string;
    type?: string;
  }>();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const { nhost, isAuthenticated } = useAuth();

  useEffect(() => {
    const { refreshToken, type } = params;

    if (!refreshToken) {
      setStatus("error");
      setError("No authentication token found");
      return;
    }

    async function processAuthentication(): Promise<void> {
      try {
        // Show verifying state briefly
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Authenticate using refresh token from OAuth flow
        await nhost.auth.refreshToken({ refreshToken });

        setStatus("success");

        // Redirect after showing success message
        setTimeout(() => {
          router.replace("/profile");
        }, 1500);
      } catch (err) {
        setStatus("error");
        setError(`Authentication failed: ${err.message}`);
      }
    }

    processAuthentication();
  }, [params, nhost.auth]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && status !== "verifying") {
      router.replace("/profile");
    }
  }, [isAuthenticated, status]);

  // ... UI implementation for different states
}
```

### Authentication States

1. **Verifying**: Processing OAuth callback and exchanging tokens
2. **Success**: Authentication completed successfully
3. **Error**: OAuth flow failed or was cancelled

## User Data Handling

### GitHub Profile Information

When users authenticate with GitHub, Nhost receives:

```typescript
// User profile data from GitHub
interface GitHubUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  metadata: {
    github: {
      id: number;
      login: string;
      name: string;
      company?: string;
      blog?: string;
      location?: string;
      bio?: string;
      public_repos: number;
      followers: number;
      following: number;
      created_at: string;
    };
  };
}
```

### Accessing User Data

```typescript
// Access GitHub-specific user data
const { user } = useAuth();

if (user?.metadata?.github) {
  const githubData = user.metadata.github;
  console.log("GitHub username:", githubData.login);
  console.log("Public repos:", githubData.public_repos);
  console.log("Followers:", githubData.followers);
}
```

## Error Handling

### OAuth Flow Errors

```typescript
// Common OAuth error scenarios
const handleOAuthErrors = (error: any) => {
  switch (error.type) {
    case "access_denied":
      // User denied permission
      Alert.alert("Access Denied", "You need to grant permission to continue");
      break;

    case "invalid_request":
      // Malformed OAuth request
      Alert.alert("Error", "Invalid authentication request");
      break;

    case "server_error":
      // GitHub server error
      Alert.alert("Error", "GitHub is temporarily unavailable");
      break;

    case "temporarily_unavailable":
      // Service temporarily unavailable
      Alert.alert("Error", "Authentication service is busy. Please try again.");
      break;

    default:
      Alert.alert("Error", "Authentication failed. Please try again.");
  }
};
```

### Network and Integration Errors

```typescript
// Handle Nhost integration errors
const processOAuthCallback = async (refreshToken: string) => {
  try {
    await nhost.auth.refreshToken({ refreshToken });
  } catch (error) {
    if (error.message.includes("Invalid refresh token")) {
      throw new Error("Authentication session expired. Please try again.");
    }

    if (error.message.includes("Network")) {
      throw new Error("Network error. Please check your connection.");
    }

    throw new Error("Authentication failed. Please try again.");
  }
};
```

## Testing Social Authentication

### Development Testing

1. **Start Development Server**:

   ```bash
   npx expo start
   ```

2. **Configure Test Environment**:

   - Ensure GitHub OAuth app has correct callback URL
   - Verify Nhost GitHub provider configuration
   - Check network connectivity between device and development server

3. **Test OAuth Flow**:
   - Tap "Continue with GitHub" button
   - Should open system browser with GitHub OAuth page
   - Log in with GitHub credentials
   - Grant permissions to the app
   - Should redirect back to app and authenticate

### Test Scenarios

```typescript
// Test different OAuth scenarios
const testScenarios = [
  "First-time GitHub authentication",
  "Returning GitHub user",
  "User cancels OAuth flow",
  "User denies permissions",
  "GitHub account with 2FA enabled",
  "Network connection issues during OAuth",
  "Invalid OAuth configuration",
  "Expired OAuth session",
];
```

### Manual Testing Checklist

- [ ] GitHub OAuth button appears and is clickable
- [ ] Clicking button opens system browser
- [ ] GitHub login page loads correctly
- [ ] Successfully logging in redirects back to app
- [ ] App shows verification screen briefly
- [ ] User is redirected to profile after authentication
- [ ] User data is correctly populated from GitHub
- [ ] Canceling OAuth flow handles gracefully
- [ ] Network errors are handled appropriately

## Security Considerations

### OAuth Security Best Practices

1. **HTTPS Only**: All OAuth URLs use HTTPS for secure communication
2. **State Parameter**: Nhost includes state parameter to prevent CSRF attacks
3. **Short-Lived Tokens**: Authorization codes have short expiration times
4. **Secure Storage**: Refresh tokens are stored securely by Nhost
5. **Scope Limitation**: Only request necessary permissions from GitHub

### Token Security

```typescript
// Nhost handles secure token management
// - Authorization codes are exchanged server-side
// - Access tokens are not exposed to client
// - Refresh tokens are securely stored
// - Session management is handled automatically
```

## Troubleshooting

### Common Issues

| Issue                        | Symptom                                 | Solution                                                         |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| OAuth redirect doesn't work  | Browser opens but doesn't return to app | Check URL scheme configuration and GitHub OAuth app callback URL |
| "Invalid client" error       | GitHub shows OAuth error page           | Verify GitHub OAuth app Client ID in Nhost dashboard             |
| "Redirect URI mismatch"      | GitHub rejects OAuth request            | Ensure callback URL in GitHub app matches Nhost configuration    |
| App doesn't open after OAuth | Browser stays open after GitHub login   | Check deep linking configuration and app installation            |

### Debug Steps

1. **Check OAuth URL**:

   ```typescript
   const url = nhost.auth.signInProviderURL("github", {
     redirectTo: redirectUrl,
   });
   console.log("OAuth URL:", url);
   ```

2. **Verify Redirect URL**:

   ```typescript
   const redirectUrl = Linking.createURL("verify");
   console.log("Redirect URL:", redirectUrl);
   ```

3. **Check URL Parameters**:

   ```typescript
   // In verify screen
   console.log("Received parameters:", params);
   ```

4. **Test Manual URL**:
   - Copy OAuth URL from console
   - Paste into browser to test flow manually

### GitHub-Specific Debugging

1. **Check GitHub OAuth App Settings**:

   - Verify callback URLs are correctly configured
   - Ensure app is not suspended or restricted

2. **Monitor GitHub OAuth Logs**:

   - Check GitHub OAuth app's activity logs
   - Look for failed authorization attempts

3. **Validate GitHub Scopes**:
   - Ensure requested scopes match app requirements
   - Check if user has granted necessary permissions

## Production Deployment

### GitHub OAuth App Configuration

For production deployment:

1. **Production Callback URL**:

   ```
   https://[subdomain].auth.[region].nhost.run/v1/auth/providers/github/callback
   ```

2. **Homepage URL**: Set to your production app's homepage

3. **Application Description**: Provide clear description of your app's purpose

### Universal Links Setup

Configure universal links for seamless production experience:

```json
// apple-app-site-association (iOS)
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.nhost.reactnativewebdemo",
        "paths": ["/verify*", "/auth/callback*"]
      }
    ]
  }
}
```

### Security Hardening

1. **Environment Variables**: Store sensitive OAuth credentials securely
2. **Domain Validation**: Implement additional domain validation for callbacks
3. **Rate Limiting**: Configure rate limiting for OAuth endpoints
4. **Monitoring**: Set up monitoring for failed OAuth attempts

## Extending to Other Providers

### Adding New OAuth Providers

The implementation can be easily extended to support other providers:

```typescript
// Extended provider support
type SocialProvider = "github" | "google" | "facebook" | "discord";

const handleSocialLogin = (provider: SocialProvider) => {
  const redirectUrl = Linking.createURL("verify");
  const url = nhost.auth.signInProviderURL(provider, {
    redirectTo: redirectUrl,
  });
  void Linking.openURL(url);
};

// Provider-specific UI
const getProviderIcon = (provider: SocialProvider) => {
  switch (provider) {
    case "github":
      return "logo-github";
    case "google":
      return "logo-google";
    case "facebook":
      return "logo-facebook";
    case "discord":
      return "logo-discord";
  }
};
```

## Related Documentation

- [Protected Routes & Email Auth](./README_PROTECTED_ROUTES.md)
- [Native Authentication](./README_NATIVE_AUTHENTICATION.md)
- [Magic Links](./README_MAGIC_LINKS.md)

## External Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Nhost Social Authentication](https://docs.nhost.io/authentication/social-login)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [React Native Deep Linking](https://reactnative.dev/docs/linking)
