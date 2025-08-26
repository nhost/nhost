import React from 'react';
import Button from '@components/Button';
import ControlledInput from '@components/ControlledInput';
import {useSignUpEmailPassword} from '@nhost/react';
import {NavigationProp, ParamListBase} from '@react-navigation/native';
import {useForm} from 'react-hook-form';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

    const {isError, error, needsEmailVerification} = await signUpEmailPassword(
      email,
      password,
      {
        displayName: `${firstName} ${lastName}`,
      },
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
    <SafeAreaView style={styles.safeAreaView}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.signUp}>Sign Up</Text>
        </View>
        <View style={styles.formWrapper}>
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

const styles = StyleSheet.create({
  safeAreaView: {flex: 1},
  scrollView: {backgroundColor: 'white', flex: 1},
  header: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUp: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  formWrapper: {
    width: '100%',
    gap: 15,
    paddingLeft: 30,
    paddingRight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
