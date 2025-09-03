# Setting Up Apple Sign In for Nhost Authentication

This guide will walk you through the steps to configure Apple Sign In for your React Native application with Nhost authentication.

## Prerequisites

- An Apple Developer account
- Xcode 11 or later
- Access to the Apple Developer portal

## 1. Configure Your App in the Apple Developer Portal

1. Log in to the [Apple Developer portal](https://developer.apple.com/)
2. Go to "Certificates, Identifiers & Profiles"
3. Select "Identifiers" and create a new App ID if you haven't already
4. Enable "Sign In with Apple" capability for your App ID
5. Save your changes

## 2. Create a Service ID for Sign In with Apple

1. In the Apple Developer portal, go to "Certificates, Identifiers & Profiles"
2. Select "Identifiers" and click the "+" button to add a new identifier
3. Choose "Services IDs" and click "Continue"
4. Enter a description and identifier (e.g., "com.nhost.reactnativewebdemo.service")
5. Check "Sign In with Apple" and click "Configure"
6. Add your domain to the "Domains and Subdomains" field
7. Add your return URL in the "Return URLs" field. This should match your Nhost redirect URL
8. Save and register the service ID

## 3. Configure Nhost for Apple Sign In

1. In your Nhost dashboard, go to Authentication > Providers > Apple
2. Enable the provider
3. Enter the following details:
   - Team ID: Found in your Apple Developer account
   - Service ID: The identifier you created in step 2
   - Key ID: Create a new key with "Sign In with Apple" enabled in the Apple Developer portal
   - Private Key: The downloaded key file content

## 4. Configure Your Expo/React Native App

1. Make sure the `expo-apple-authentication` package is installed

   ```
   npx expo install expo-apple-authentication
   ```

2. Ensure your app.json has the proper configuration:

   ```json
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

3. If you're using EAS Build, make sure you've configured your Apple Developer Team ID:
   ```
   eas credentials
   ```

## 5. Testing Apple Sign In

When you build your app for iOS:

1. Use a real device or simulator running iOS 13 or later
2. Make sure you're signed into an Apple ID on the device
3. Use the Apple Sign In button and authenticate
4. The app will receive an ID token that is sent to Nhost
5. Nhost will verify the token and create or authenticate the user

## Troubleshooting

- **Invalid Client ID**: Ensure your Service ID is properly configured in the Apple Developer portal
- **Authentication Failed**: Check that your Nhost Apple provider configuration is correct
- **App Build Issues**: Ensure the `expo-apple-authentication` package is properly installed and your app.json is configured correctly

## Security Considerations

- Never store Apple private keys in your front-end code
- The authentication process should always validate tokens on the server side (which Nhost handles)
- Keep your Apple Developer account secure

## Additional Resources

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Nhost Authentication Documentation](https://docs.nhost.io/authentication)
- [Expo Apple Authentication Documentation](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
