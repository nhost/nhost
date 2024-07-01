import { useNhostClient } from '@nhost/react'
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer'
import { DrawerContentComponentProps } from '@react-navigation/drawer/lib/typescript/src/types'
import Button from './Button'
import { useState } from 'react'
import { SafeAreaView, StyleSheet, View } from 'react-native'

export default function Drawer(props: DrawerContentComponentProps) {
  const nhost = useNhostClient()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    await nhost.auth.signOut()
    setLoading(false)
  }

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContentScrollView}>
      <SafeAreaView style={styles.safeAreaView}>
        <View>
          <DrawerItemList {...props} />
        </View>
        <View style={styles.signOutButtonWrapper}>
          <Button loading={loading} disabled={loading} label="Sign Out" onPress={handleSignOut} />
        </View>
      </SafeAreaView>
    </DrawerContentScrollView>
  )
}

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 10
  },
  signOutButtonWrapper: {
    paddingHorizontal: 10
  },
  drawerContentScrollView: {
    flex: 1
  }
})
