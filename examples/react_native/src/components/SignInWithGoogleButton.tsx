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
        const idToken = response?.data?.idToken as string;
        signInIdToken('google', idToken);
      } else {
        // sign in was cancelled by user
      }
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.IN_PROGRESS:
            // operation (eg. sign in) already in progress
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            // Android only, play services not available or outdated
            break;
          default:
          // some other error happened
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
