import UploadFile from '@components/UploadFile'
import { StyleSheet, View } from 'react-native'

export default function Storage() {
  return (
    <View style={styles.wrapper}>
      <UploadFile />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: 20,
    gap: 20
  }
})
