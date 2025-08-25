import CustomDrawer from '@components/Drawer'
import { useAuthenticationStatus } from '@nhost/react'
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
  DrawerNavigationProp
} from '@react-navigation/drawer'
import { NavigationContainer, ParamListBase } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Profile from '@screens/Profile'
import SignIn from '@screens/SignIn'
import SignUp from '@screens/SignUp'
import Storage from '@screens/Storage'
import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

const Drawer = createDrawerNavigator()
const Stack = createNativeStackNavigator()

function LoadingIndicatorView() {
  return (
    <View style={styles.loadingContainerWrapper}>
      <ActivityIndicator size="large" />
    </View>
  )
}

const screenOptions = ({ navigation }: { navigation: DrawerNavigationProp<ParamListBase> }) => ({
  headerLeft: () => (
    <Icon
      name="menu"
      size={30}
      color="black"
      onPress={navigation.toggleDrawer}
      style={styles.drawerMenuIcon}
    />
  )
})

const drawerContent = (props: DrawerContentComponentProps) => <CustomDrawer {...props} />

function DrawerNavigator() {
  return (
    <Drawer.Navigator screenOptions={screenOptions} drawerContent={drawerContent}>
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen name="Storage" component={Storage} />
    </Drawer.Navigator>
  )
}

export default function Main() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus()

  if (isLoading) {
    return <LoadingIndicatorView />
  }

  return (
    <NavigationContainer
      linking={{
        prefixes: ['myapp://']
      }}
      fallback={<LoadingIndicatorView />}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="signin" component={SignIn} />
            <Stack.Screen name="signup" component={SignUp} />
          </>
        ) : (
          <Stack.Screen name="drawer" component={DrawerNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  drawerMenuIcon: {
    marginLeft: 14
  }
})
