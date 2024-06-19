# Nhost React Native Template

This template bootstrapped using `react-native-community/cli` showcases how to properly use Nhost SDK within your React Native project.

For a more comprehensive guide on how to build on top of this template you can follow the [quickstart guide](https://docs.nhost.io/guides/quickstarts/react-native).

## Features

- Email/Password Authentication
- Sign-in with Apple and Google
- File upload

##  Usage

> Ensure that your environment is set up to work with React Native. Follow the [setup guide](https://reactnative.dev/docs/set-up-your-environment) available on the official React Native website.

1. Initialize your project with this template
      ```sh
      npx react-native init myapp --template @nhost/react-native-template
      ```

2. Replace the `subdomain` and `region` placeholders in the [`root.tsx`](src/root.tsx#L9C1-L10C1) with your Nhost project values from the overview page.

## How to enable Sign in with Apple and/or Google
Navigate to your nhost project [Sign-In Methods settings](https://app.nhost.io/_/_/settings/sign-in-methods) and enable Google and/or Apple.

## Configure Permissions for uploading files
1. Edit the **files** table permissions
      1. Navigate to the files table within the [Database tab](https://app.nhost.io/_/_/database/browser/default/storage/files)
	2. Click on the three dots (...) next to the files table
	3. Click on **Edit Permissions**

2. Modify the `Insert` permission for the `user` role:
      1. Set `Row insert permissions` to `Without any checks`
      2. Select all columns on `Column insert permissions`
      4. Save

3. `Select`
        - Set `Row select permissions` to `With custom check` and fill in the following rule:
            - Set `Where` to `files.uploaded_by_user_id`
            - Set the operator to `_eq`
            - Set the value to `X-Hasura-User-Id`
        - Select all columns on `Column select permissions`
        - Save

