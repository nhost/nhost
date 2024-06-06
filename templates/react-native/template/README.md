# Nhost React Native example

This project bootstrapped using `react-native-community/cli` showcases how to properly use Nhost SDK within your React Native project.

## Prerequisites

1. Install the React Native CLI `npm i -g @react-native-community/cli`

2. iOS requirements (macOS only):

   1. Install the latest version of Xcode from the Mac App Store
   2. Ensure Xcode Command Line Tools are installed: `xcode-select --install`
   3. Install CocoaPods `sudo gem install cocoapods`

3. Android requirements:

   1. Install Java Development Kit: [OpenJDK Azul Zulu](https://www.azul.com/downloads/?architecture=x86-64-bit#zulu) is recommneded
   1. Install Android Studio and make sure the following items are checked
      - Android SDK
      - Android SDK Platform
      - Android Virtual Device
   1. Install the Android SDK using the SDK Manager in Android Studio
   1. Configure the ANDROID_HOME environment variable by adding the following to your shell
      ```bash
      export ANDROID_HOME=$HOME/Library/Android/sdk
      export PATH=$PATH:$ANDROID_HOME/emulator
      export PATH=$PATH:$ANDROID_HOME/platform-tools
      ```
      > For more details on how to setup you environmnet please refer to the official [react-native quick
      > start guide](https://reactnative.dev/docs/set-up-your-environment).

4. Configure `dnsmasq` to be able to connect to your nhost project running locally (the following setps are for macOS, if you're using another OS please refer to the official docs)

   1. Install `dnsmasq`
      ```sh
      brew install dnsmasq
      ```
   2. When running on Android both Emulator and a real device

      1. Configure `dnsmasq` to resolve nhost service urls to your machine's special loopback address `10.0.2.2`
         ```shell
         echo 'address=/nhost.run/10.0.2.2' >> $(brew --prefix)/etc/dnsmasq.conf
         ```
      2. Restart `dnsmasq`
         ```shell
         sudo brew services start dnsmasq
         ```
      3. Configure the android device's DNS settings
         1. Edit your network settings: Settings > Network & Internet > Internet > AndroidWifi
         2. set `IP settings` to `Static`
         3. set `DNS 1` and `DNS 2` to `10.0.2.2`
         4. Save

   3. When running on physical iPhone device
      1. Inspect your machine's IP address on your network
         ```shell
         ipconfig getifaddr en0
         ```
      1. Configure `dnsmasq` to resolve nhost service urls to your machine's ip address (example: 172.20.10.4)
         ```shell
         echo 'address=/nhost.run/172.20.10.4' >> $(brew --prefix)/etc/dnsmasq.conf
         ```
      1. Restart `dnsmasq`
         ```shell
         sudo brew services start dnsmasq
         ```
      1. Configure the iPhone's DNS settings
         1. Select the wifi you're connected and select `Configure DNS`
         2. Select `Manual`
         3. Click on `Add server` and type your local machine's IP address
         4. Save

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
