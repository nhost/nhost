# Nhost React Native example

This project bootstrapped using `react-native-community/cli` showcases how to properly use Nhost SDK within your React Native project.

## Get Started

1. Clone the repository

   ```sh
   git clone https://github.com/nhost/nhost
   cd nhost
   ```

2. Install and build dependencies

   ```sh
   pnpm install
   pnpm build
   ```

3. Terminal 1: Start the Nhost Backend

   1. Create the `.secrets` file
      To be able to start the nhost project locally: you need to a create this file that holds your porject's secrets, follow these guides [Sign In with Apple](https://docs.nhost.io/guides/auth/social/sign-in-apple), [Sign In With Google](https://docs.nhost.io/guides/auth/social/sign-in-google) to setup OAuth and fill the secrets

      ```sh
      cp .secrets.example .secrets
      ```

   2. Start the nhost project

      > Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli).

      ```sh
      cd examples/react_native
      nhost up
      ```

4. Terminal 2: Start the Metro bundler

   ```sh
   cd examples/react_native
   pnpm start
   ```

5. Terminal 3: Start the app on either the Android emulator or iOS simulator

   1. Android

      ```sh
      cd examples/react_native
      pnpm android
      ```

   2. iOS
      ```sh
      cd examples/react_native
      pnpm ios
      ```
