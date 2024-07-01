import { useHasuraClaims, useUserData } from '@nhost/react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

export default function Profile() {
  const user = useUserData()
  const claims = useHasuraClaims()

  return (
    <View style={styles.wrapper}>
      <Text style={styles.subTitle}>User information</Text>
      <ScrollView horizontal persistentScrollbar contentContainerStyle={styles.codeScrollView}>
        <Text style={styles.code}>{JSON.stringify(user, null, 2)}</Text>
      </ScrollView>
      <Text style={styles.subTitle}>Hasura JWT claims</Text>
      <ScrollView horizontal persistentScrollbar contentContainerStyle={styles.codeScrollView}>
        <Text style={styles.code}>{JSON.stringify(claims, null, 2)}</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    padding: 12,
    gap: 10
  },
  subTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black'
  },
  code: {
    fontFamily: 'monospace',
    color: 'black'
  },
  codeScrollView: {
    backgroundColor: 'white',
    borderRadius: 10
  }
})
