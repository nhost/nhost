import {useNhostClient, useSignInEmailPassword} from '@nhost/react';
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

          <SignInWithAppleButton />
          <SignInWithGoogleButton />

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
