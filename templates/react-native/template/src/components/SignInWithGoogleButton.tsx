import Button from '@components/Button'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

export default function SignInWithGoogleButton({
  handleSignIn
}: {
  handleSignIn: () => Promise<void>
}) {
  return (
    <Button
      label={
        <View style={styles.labelWrapper}>
          <Icon name="google" color="white" size={20} />
          <Text style={styles.text}>Sign in with Google</Text>
        </View>
      }
      color="#de5246"
      onPress={handleSignIn}
    />
  )
}

const styles = StyleSheet.create({
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  }
})
