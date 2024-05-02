import Button from '@components/Button';
import {useNhostClient} from '@nhost/react';
import {Alert, Linking, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SignInWithGoogleButton() {
  const nhost = useNhostClient();

  const handleSignInWithGoogle = async () => {
    const {providerUrl} = await nhost.auth.signIn({
      provider: 'google',
      options: {
        redirectTo: 'myapp://',
      },
    });

    if (providerUrl) {
      try {
        if (await Linking.canOpenURL(providerUrl)) {
          Linking.openURL(providerUrl);
        }
      } catch (error) {
        console.log(error);
        Alert.alert('Error', 'An error occurred');
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
