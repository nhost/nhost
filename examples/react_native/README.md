# Nhost React Native example

This example project is based on the [Nhost React Native Template](https://www.npmjs.com/package/@nhost/react-native-template). It is the result of following the [React Native quickstart guide](https://docs.nhost.io/guides/quickstarts/react-native)

## Prerequisites

Ensure that your environment is set up to work with React Native. Follow the [setup guide](https://reactnative.dev/docs/set-up-your-environment) available on the official React Native website.

## Get Started

1. Clone the repository

   ```sh
   git clone https://github.com/nhost/nhost
   cd nhost
   ```

2. Install and build dependencies

   ```sh
   pnpm install
   pnpm build:all
   ```

3. **Terminal 1**: Run the local Nhost Project

   1. Navigate to the backend directory
         ```sh
         cd examples/react_native/backend
         ```

   1. Create the `.secrets` file
      To be able to start the nhost project locally: you need to a create this file that holds your porject's secrets, follow these guides [Sign In with Apple](https://docs.nhost.io/guides/auth/social/sign-in-apple), [Sign In With Google](https://docs.nhost.io/guides/auth/social/sign-in-google) to setup OAuth and fill the secrets

      ```sh
      cp .secrets.example .secrets
      ```

   2. Start the nhost project

      > Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli).

      ```sh
      nhost up
      ```

4. **Terminal 2**: Start the Metro bundler

   ```sh
   cd examples/react_native
   pnpm start
   ```

5. **Terminal 3**: Start the app on either the Android emulator or iOS simulator

   - Android

      ```sh
      cd examples/react_native
      pnpm android
      ```

   - iOS
      1. Install the iOS Pods
      ```sh
      cd examples/react_native/ios
      pod install
      ```
      2. Run on the iOS simulator
      ```sh
      cd examples/react_native
      pnpm ios --interactive
      ```
