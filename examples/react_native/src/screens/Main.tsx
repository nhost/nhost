import {useAuthenticationStatus} from '@nhost/react';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import Profile from './Profile';
import SignUp from './SignUp';
import SignIn from './SignIn';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function Main() {
  const {isAuthenticated, isLoading} = useAuthenticationStatus();

  if (isLoading) {
    return (
      <View style={styles.loadingContainerWrapper}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
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
  );
}

function DrawerNavigator() {
  return (
    <Drawer.Navigator>
      <Drawer.Screen name="Profile" component={Profile} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'beige',
  },
});

export default Main;
