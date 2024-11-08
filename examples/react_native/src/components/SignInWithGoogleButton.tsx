import React, {useState} from 'react';
import Button from '@components/Button';
import {Alert, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {NativeModules} from 'react-native';
const {RNRandomBytes} = NativeModules;
import {
  GoogleSignin,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {useSignInIdToken} from '@nhost/react';

GoogleSignin.configure({
  webClientId: process.env.GOOGLE_CLIENT_ID,
});

export default function SignInWithGoogleButton() {
  const {signInIdToken} = useSignInIdToken();

  const handleSignInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const {isSuccess, isError} = await signInIdToken(
          'google',
          response?.data?.idToken as string,
        );

        console.log({
          isError,
          isSuccess,
        });
      } else if (isNoSavedCredentialFoundResponse(response)) {
        // Android and Apple only.
        // No saved credential found (user has not signed in yet, or they revoked access)
        // call `createAccount()`
      }
    } catch (error) {
      console.error(error);
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.ONE_TAP_START_FAILED:
            // Android-only, you probably have hit rate limiting.
            // You can still call `presentExplicitSignIn` in this case.
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            // Android: play services not available or outdated.
            // Get more details from `error.userInfo`.
            // Web: when calling an unimplemented api (requestAuthorization)
            // or when the Google Client Library is not loaded yet.
            break;
          default:
          // something else happened
        }
      } else {
        // an error that's not related to google sign in occurred
      }
    }
  };

  return (
    <Button
      label={
        <View style={styles.labelWrapper}>
          <Icon name="google" color="white" size={20} />
          <Text style={styles.text}>Sign in with Google</Text>
        </View>
      }
      color="#de5246"
      onPress={handleSignInWithGoogle}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
