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

interface SignUpFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export default function SignUp() {
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
            paddingLeft: 10,
            paddingRight: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Controller
            control={control}
            render={({field: {onChange, onBlur, value}}) => (
              <TextInput
                style={{
                  width: '100%',
                  marginBottom: 10,
                  backgroundColor: 'ghostwhite',

                  padding: 12,
                  borderRadius: 10,
                }}
                placeholder="First name"
                onBlur={onBlur}
                onChangeText={value => onChange(value)}
                value={value}
              />
            )}
            name="firstName"
            rules={{required: true}}
          />

          <View style={{width: '100%'}}>
            <Controller
              control={control}
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  style={{
                    width: '100%',
                    marginBottom: 10,
                    backgroundColor: 'ghostwhite',

                    padding: 12,
                    borderRadius: 10,
                  }}
                  placeholder="Last name"
                  onBlur={onBlur}
                  onChangeText={value => onChange(value)}
                  value={value}
                />
              )}
              name="lastName"
              rules={{required: true}}
            />
          </View>

          <View style={{width: '100%'}}>
            <Controller
              control={control}
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  style={{
                    width: '100%',
                    marginBottom: 10,
                    backgroundColor: 'ghostwhite',

                    padding: 12,
                    borderRadius: 10,
                  }}
                  placeholder="Email"
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={value => onChange(value)}
                  value={value}
                  keyboardType="email-address"
                />
              )}
              name="email"
              rules={{required: true}}
            />
          </View>

          <View style={{width: '100%'}}>
            <Controller
              control={control}
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  style={{
                    width: '100%',
                    marginBottom: 20,
                    backgroundColor: 'ghostwhite',

                    padding: 12,
                    borderRadius: 10,
                  }}
                  placeholder="Password"
                  onBlur={onBlur}
                  onChangeText={value => onChange(value)}
                  value={value}
                  secureTextEntry
                />
              )}
              name="password"
              rules={{required: true}}
            />
          </View>

          <View
            style={{
              width: '100%',
            }}>
            <Pressable
              disabled={isLoading}
              onPress={handleSubmit(onSubmit)}
              style={({pressed}) => [
                {
                  alignItems: 'center',
                  backgroundColor: pressed ? '#3378E0' : '#3888ff',
                },
                {
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                },
              ]}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{color: 'white', fontWeight: 'bold'}}>
                  Sign Up
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
