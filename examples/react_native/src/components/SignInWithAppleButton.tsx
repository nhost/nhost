import Button from '@components/Button';
import {useNhostClient} from '@nhost/react';
import {Alert, Linking, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SignInWithAppleButton() {
  const nhost = useNhostClient();

  const handleSignInWithApple = async () => {
    const {providerUrl} = await nhost.auth.signIn({
      provider: 'apple',
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
