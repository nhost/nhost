import {
  useNhostClient,
  useProviderLink,
  useSignInEmailPassword,
} from '@nhost/react';
import {Passkey, PasskeyRegistrationResult} from 'react-native-passkey';
import {NavigationProp, ParamListBase} from '@react-navigation/native';
import {useForm} from 'react-hook-form';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Button from '@components/Button';
import ControlledInput from '@components/ControlledInput';
import SignInWithAppleButton from '@components/SignInWithAppleButton';
import SignInWithGoogleButton from '@components/SignInWithGoogleButton';
import InAppBrowser from 'react-native-inappbrowser-reborn';

interface SignUpFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export default function SignIn({
  navigation,
}: {
  navigation: NavigationProp<ParamListBase>;
}) {
  const nhost = useNhostClient();
  const {apple, google} = useProviderLink({
    redirectTo: 'myapp://',
  });

  const {control, handleSubmit} = useForm<SignUpFormValues>();
  const {signInEmailPassword, isLoading} = useSignInEmailPassword();

  const onSubmit = async (data: SignUpFormValues) => {
    const {email, password} = data;

    const {isError, error, needsEmailVerification} = await signInEmailPassword(
      email,
      password,
    );

    if (isError) {
      Alert.alert('Error', error?.message);
      return;
    }

    if (needsEmailVerification) {
      Alert.alert(
        'Check your inbox',
        "Click on the link we've sent to your inbox to verify your account and sign in",
      );
      return;
    }
  };

  const handleSignInWithSecurityKey = async () => {
    const isSupported = Passkey.isSupported();

    if (isSupported) {
      try {
        const res = await fetch(
          'https://local.auth.nhost.run/v1/signup/webauthn',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              email: 'hsanbenjobrane@gmail.com',
            }),
          },
        );

        if (!res.ok) {
          throw new Error('Request to sign in failed');
        }

        const challengeRequest = await res.json();

        console.log({
          challengeRequest,
        });

        // Call the `register` method with the retrieved request in JSON format
        // A native overlay will be displayed
        const result: PasskeyRegistrationResult = await Passkey.register(
          challengeRequest,
        );

        console.log({
          result,
        });

        // const verification = await fetch(
        //   'https://local.auth.nhost.run/signin/webauthn/verify',
        //   {
        //     headers: {
        //       'content-type': 'application/json',
        //     },
        //     body: JSON.stringify({
        //       email: 'hsanbenjobrane@gmail.com',
        //       credential: result,
        //     }),
        //   },
        // );

        // if (!verification.ok) {
        //   throw new Error('Verification failed');
        // }

        // const session = await verification.json();

        // console.log({
        //   session,
        // });

        // The `register` method returns a FIDO2 attestation result
        // Pass it to your server for verification
      } catch (error) {
        console.log({error});
        // Handle Error...
        Alert.alert('webauthn', `An error has occurred`);
      }
    } else {
      Alert.alert('webauthn', `${isSupported}`);
    }
  };

  const handleSignInWithOAuth = async (providerLink: string) => {
    try {
      const response = await InAppBrowser.openAuth(
        providerLink,
        'myapp://',
        {},
      );

      if (response.type === 'success' && response.url) {
        const refreshToken =
          response.url.match(/refreshToken=([^&]*)/)?.at(1) ?? null;

        if (refreshToken) {
          const {error} = await nhost.auth.refreshSession(refreshToken);

          if (error) {
            throw error;
          }
        } else {
          throw new Error('An error occurred during the sign-in process');
        }
      }
    } catch (error) {
      console.log({error});
      Alert.alert('Error', 'An error occurred during the sign-in process.');
    }
  };

  const handleSignInWithApple = () => handleSignInWithOAuth(apple);
  const handleSignInWithGoogle = () => handleSignInWithOAuth(google);

  return (
    <SafeAreaView style={{flex: 1}}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{backgroundColor: 'white', flex: 1}}>
        <View
          style={{
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              fontSize: 30,
              fontWeight: 'bold',
            }}>
            Sign In
          </Text>
        </View>
        <View
          style={{
            gap: 15,
            paddingLeft: 30,
            paddingRight: 30,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
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

          <ControlledInput
            control={control}
            name="password"
            placeholder="Password"
            secureTextEntry
            rules={{
              required: true,
            }}
          />

          <Button
            loading={isLoading}
            disabled={isLoading}
            label="Sign In"
            onPress={handleSubmit(onSubmit)}
          />

          <SignInWithAppleButton hanldeSignIn={handleSignInWithApple} />
          <SignInWithGoogleButton handleSignIn={handleSignInWithGoogle} />

          <Button
            loading={isLoading}
            disabled={isLoading}
            label="Sign in with security key"
            onPress={handleSignInWithSecurityKey}
          />

          <View
            style={{
              height: 2,
              backgroundColor: '#D3D3D3',
              width: '50%',
              marginVertical: 10,
            }}
          />

          <Button
            label="Sign Up"
            onPress={() => navigation.navigate('signup')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
