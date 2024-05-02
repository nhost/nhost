import {useSignUpEmailPassword} from '@nhost/react';
import {Controller, useForm} from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Button from '../components/Button';
import {NavigationProp, ParamListBase} from '@react-navigation/native';
import ControlledInput from '../components/ControlledInput';

interface SignUpFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export default function SignUp({
  navigation,
}: {
  navigation: NavigationProp<ParamListBase>;
}) {
  const {control, handleSubmit} = useForm<SignUpFormValues>();

  const {signUpEmailPassword, isLoading} = useSignUpEmailPassword();

  const onSubmit = async (data: SignUpFormValues) => {
    const {firstName, lastName, email, password} = data;

    const {isError, error, user, needsEmailVerification} =
      await signUpEmailPassword(email, password, {
        displayName: `${firstName} ${lastName}`,
      });

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
            Sign Up
          </Text>
        </View>
        <View
          style={{
            width: '100%',
            gap: 10,
            paddingLeft: 10,
            paddingRight: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ControlledInput
            control={control}
            name="firstName"
            placeholder="First name"
            rules={{
              required: true,
            }}
          />

          <ControlledInput
            control={control}
            name="lastName"
            placeholder="Last name"
            rules={{
              required: true,
            }}
          />

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
            label="Sign Up"
            onPress={handleSubmit(onSubmit)}
          />

          <Button
            label="Sign In"
            onPress={() => navigation.navigate('signin')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
