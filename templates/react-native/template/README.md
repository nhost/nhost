# Nhost React Native Template

This template bootstrapped using `react-native-community/cli` showcases how to properly use Nhost SDK within your React Native project.

For a more comprehensive guide on how to build on top of this template you can follow our [quickstart guide](https://docs.nhost.io/guides/quickstarts/react-native).

## Features

- Email/Password Authentication
- Sign-in with Apple and Google
- File upload

##  Usage

1. Initialize your project with this template
      ```sh
      npx react-native init myapp --template nhost-react-native-template
      ```
2. Replace the `subdomain` and `region` placeholders in the [`root.tsx`](src/root.tsx#L9C1-L10C1) with your Nhost project values from the overview page.