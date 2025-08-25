import React from 'react';
import Button from '@components/Button';
import {StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {appleAuth} from '@invertase/react-native-apple-authentication';
import {useSignInIdToken} from '@nhost/react';
import Toast from 'react-native-simple-toast';

export default function SignInWithAppleButton() {
  const {signInIdToken} = useSignInIdToken();

  async function handleSignInWithApple() {
    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      const {identityToken, nonce} = appleAuthRequestResponse;

      if (identityToken) {
        const {isError, isSuccess, error} = await signInIdToken(
          'apple',
          identityToken,
          nonce,
        );

        if (isSuccess) {
          Toast.showWithGravity(
            'Signin with Apple succeeded',
            Toast.SHORT,
            Toast.BOTTOM,
          );
        }

        if (isError) {
          Toast.showWithGravity(
            `Signin with Apple failed: ${error?.message}`,
            Toast.SHORT,
            Toast.BOTTOM,
          );
        }
      } else {
        Toast.showWithGravity(
          'Signin with Apple failed: no idToken received',
          Toast.SHORT,
          Toast.BOTTOM,
        );
      }
    } catch (error) {
      Toast.showWithGravity(
        `Signin with Apple failed: ${JSON.stringify(error)}`,
        Toast.SHORT,
        Toast.BOTTOM,
      );
    }
  }

  return (
    <Button
      label={
        <View style={styles.labelWrapper}>
          <Icon name="apple" color="white" size={20} />
          <Text style={styles.text}>Sign in with Apple</Text>
        </View>
      }
      color="black"
      onPress={handleSignInWithApple}
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
