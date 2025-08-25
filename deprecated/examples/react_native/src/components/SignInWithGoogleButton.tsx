import Button from '@components/Button';
import {useSignInIdToken} from '@nhost/react';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-simple-toast';

GoogleSignin.configure({
  webClientId: process.env.GOOGLE_CLIENT_ID,
  iosClientId: process.env.IOS_GOOGLE_CLIENT_ID,
});

export default function SignInWithGoogleButton() {
  const {signInIdToken} = useSignInIdToken();

  const handleSignInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response?.data?.idToken as string;

        const {isError, isSuccess, error} = await signInIdToken(
          'google',
          idToken,
        );

        if (isSuccess) {
          Toast.showWithGravity(
            'Signin with Google succeeded',
            Toast.SHORT,
            Toast.BOTTOM,
          );
        }

        if (isError) {
          Toast.showWithGravity(
            `Signin with Google failed: ${error?.message}`,
            Toast.SHORT,
            Toast.BOTTOM,
          );
        }
      } else {
        Toast.showWithGravity(
          'Sign in was cancelled by user',
          Toast.SHORT,
          Toast.BOTTOM,
        );
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.IN_PROGRESS:
            // operation (eg. sign in) already in progress
            Toast.showWithGravity(
              'Signin is already in progress',
              Toast.SHORT,
              Toast.BOTTOM,
            );
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            // Android only, play services not available or outdated
            Toast.showWithGravity(
              'Play services not available or outdated',
              Toast.SHORT,
              Toast.BOTTOM,
            );
            break;
          default:
            // some other error happened
            Toast.showWithGravity(
              'An unexpected error happened',
              Toast.SHORT,
              Toast.BOTTOM,
            );
        }
      } else {
        // an error that's not related to google sign in occurred
        Toast.showWithGravity(
          'An unexpected error happened',
          Toast.SHORT,
          Toast.BOTTOM,
        );
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
