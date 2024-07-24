import Button from '@components/Button'
import { StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

export default function SignInWithAppleButton({
  hanldeSignIn
}: {
  hanldeSignIn?: () => Promise<void>
}) {
  return (
    <Button
      label={
        <View style={styles.labelWrapper}>
          <Icon name="apple" color="white" size={20} />
          <Text style={styles.text}>Sign in with Apple</Text>
        </View>
      }
      color="black"
      onPress={hanldeSignIn}
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
