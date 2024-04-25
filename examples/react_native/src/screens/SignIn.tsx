import {useSignInEmailPassword, useSignUpEmailPassword} from '@nhost/react';
import {useForm} from 'react-hook-form';
import {Alert, SafeAreaView, ScrollView, Text, View} from 'react-native';
import {ControlledInput} from '../components';
import Button from '../components/Button';

interface SignUpFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export default function SignIn() {
  const {control, handleSubmit} = useForm<SignUpFormValues>();

  const {signInEmailPassword, isLoading} = useSignInEmailPassword();

  const onSubmit = async (data: SignUpFormValues) => {
    const {email, password} = data;

    const {isError, error, user, needsEmailVerification} =
      await signInEmailPassword(email, password);

    if (isError) {
      console.log({error});
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

    console.log({
      user,
    });
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
            width: '100%',
            paddingLeft: 10,
            paddingRight: 10,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}>
          <ControlledInput
            control={control}
            name="email"
            placeholder="Email"
            style={{
              width: '100%',
              backgroundColor: 'ghostwhite',
              padding: 12,
              borderRadius: 10,
            }}
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
            style={{
              width: '100%',
              backgroundColor: 'ghostwhite',
              padding: 12,
              borderRadius: 10,
            }}
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

          <Button
            loading={isLoading}
            disabled={isLoading}
            label="Sign in with Apple"
            onPress={handleSubmit(onSubmit)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
