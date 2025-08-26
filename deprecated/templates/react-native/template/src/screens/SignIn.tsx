import Button from '@components/Button'
import ControlledInput from '@components/ControlledInput'
import SignInWithAppleButton from '@components/SignInWithAppleButton'
import SignInWithGoogleButton from '@components/SignInWithGoogleButton'
import { useNhostClient, useProviderLink, useSignInEmailPassword } from '@nhost/react'
import { NavigationProp, ParamListBase } from '@react-navigation/native'
import { useForm } from 'react-hook-form'
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import InAppBrowser from 'react-native-inappbrowser-reborn'

interface SignInFormValues {
  firstName: string
  lastName: string
  email: string
  password: string
}

export default function SignIn({ navigation }: { navigation: NavigationProp<ParamListBase> }) {
  const nhost = useNhostClient()
  const { apple, google } = useProviderLink({
    redirectTo: 'myapp://'
  })

  const { control, handleSubmit } = useForm<SignInFormValues>()
  const { signInEmailPassword, isLoading } = useSignInEmailPassword()

  const onSubmit = async (data: SignInFormValues) => {
    const { email, password } = data

    const { isError, error, needsEmailVerification } = await signInEmailPassword(email, password)

    if (isError) {
      Alert.alert('Error', error?.message)
      return
    }

    if (needsEmailVerification) {
      Alert.alert(
        'Check your inbox',
        "Click on the link we've sent to your inbox to verify your account and sign in"
      )
      return
    }
  }

  const handleSignInWithOAuth = async (providerLink: string) => {
    try {
      const response = await InAppBrowser.openAuth(providerLink, 'myapp://')

      if (response.type === 'success' && response.url) {
        const refreshToken = response.url.match(/refreshToken=([^&]*)/)?.at(1) ?? null

        if (refreshToken) {
          const { error } = await nhost.auth.refreshSession(refreshToken)

          if (error) {
            throw error
          }
        } else {
          throw new Error('An error occurred during the sign-in process')
        }
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred during the sign-in process.')
    }
  }

  const handleSignInWithApple = () => handleSignInWithOAuth(apple)
  const handleSignInWithGoogle = () => handleSignInWithOAuth(google)

  const navigateToSignUp = () => navigation.navigate('signup')

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.signIn}>Sign In</Text>
        </View>
        <View style={styles.formWrapper}>
          <ControlledInput
            control={control}
            name="email"
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            rules={{
              required: true
            }}
          />

          <ControlledInput
            control={control}
            name="password"
            placeholder="Password"
            secureTextEntry
            rules={{
              required: true
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

          <View style={styles.divider} />

          <Button label="Sign Up" onPress={navigateToSignUp} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeAreaView: { flex: 1 },
  scrollView: { backgroundColor: 'white', flex: 1 },
  header: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center'
  },
  signIn: {
    fontSize: 30,
    fontWeight: 'bold'
  },
  formWrapper: {
    gap: 15,
    paddingLeft: 30,
    paddingRight: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  divider: {
    height: 1,
    width: '50%',
    backgroundColor: '#D3D3D3',
    marginVertical: 10
  }
})
