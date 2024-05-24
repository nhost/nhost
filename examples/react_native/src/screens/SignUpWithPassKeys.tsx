import {SafeAreaView} from 'react-native-safe-area-context';
import {View, Text, ScrollView, Alert, StyleSheet} from 'react-native';

import Button from '@components/Button';
import ControlledInput from '@components/ControlledInput';
import {useForm} from 'react-hook-form';
import {NavigationProp, ParamListBase} from '@react-navigation/native';
import {Passkey, PasskeyRegistrationResult} from 'react-native-passkey';
import {useState} from 'react';

interface SignUpWithPassKeysFormValues {
  email: string;
}

export default function SignUpWithPassKeys({
  navigation,
}: {
  navigation: NavigationProp<ParamListBase>;
}) {
  const goBack = () => navigation.goBack();
  const [loading, setLoading] = useState(false);
  const {control, handleSubmit} = useForm<SignUpWithPassKeysFormValues>();

  const onSubmit = async (data: SignUpWithPassKeysFormValues) => {
    const isSupported = Passkey.isSupported();
    const {email} = data;

    const baseURL = `https://local.auth.nhost.run/v1`;

    if (isSupported) {
      try {
        setLoading(true);

        const res = await fetch(`${baseURL}/signup/webauthn`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            email,
          }),
        });

        if (!res.ok) {
          throw new Error('Request to sign-in with passkeys failed');
        }

        const challengeRequest = await res.json();

        // Call the `register` method with the retrieved request in JSON format
        // A native overlay will be displayed
        const credential: PasskeyRegistrationResult = await Passkey.register(
          challengeRequest,
        );

        const verification = await fetch(`${baseURL}/signup/webauthn/verify`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            credential,
          }),
        });

        if (!verification.ok) {
          throw new Error('Verification failed');
        }

        const session = await verification.json();

        // await nhost.auth.refreshSession(session)
      } catch (error) {
        console.log({error});
        // Handle Error...
        Alert.alert('webauthn', `An error has occurred`);
      } finally {
        setLoading(false);
      }
    } else {
      Alert.alert('webauthn', `${isSupported}`);
    }
  };

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scrollView}>
        <View style={styles.signInHeader}>
          <Text style={styles.signInText}>Sign up with passkeys</Text>
        </View>
        <View style={styles.formWrapper}>
          <ControlledInput
            control={control}
            name="email"
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            rules={{
              required: true,
            }}
          />

          <Button
            loading={loading}
            disabled={loading}
            label="Sign Up"
            onPress={handleSubmit(onSubmit)}
          />

          <View style={styles.divider} />

          <Button label="Other sign-up options" onPress={goBack} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {backgroundColor: 'white', flex: 1},
  safeAreaView: {flex: 1},
  divider: {
    height: 2,
    backgroundColor: '#D3D3D3',
    width: '50%',
    marginVertical: 10,
  },
  formWrapper: {
    gap: 15,
    paddingLeft: 30,
    paddingRight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  signInHeader: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
