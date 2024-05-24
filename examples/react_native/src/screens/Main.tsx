import CustomDrawer from '@components/Drawer';
import {useAuthenticationStatus} from '@nhost/react';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Profile from '@screens/Profile';
import SignIn from '@screens/SignIn';
import SignUpWithPassKeys from '@screens/SignUpWithPassKeys';
import SignUp from '@screens/SignUp';
import Storage from '@screens/Storage';
import Todos from '@screens/Todos';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function LoadingIndicatorView() {
  return (
    <View style={styles.loadingContainerWrapper}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function Main() {
  const {isAuthenticated, isLoading} = useAuthenticationStatus();

  if (isLoading) {
    return <LoadingIndicatorView />;
  }

  return (
    <NavigationContainer
      linking={{
        prefixes: ['myapp://'],
      }}
      fallback={<LoadingIndicatorView />}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="signin" component={SignIn} />
            <Stack.Screen name="signup" component={SignUp} />
            <Stack.Screen
              name="signUpWithPassKeys"
              component={SignUpWithPassKeys}
            />
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
    <Drawer.Navigator
      screenOptions={({navigation}) => ({
        headerLeft: () => (
          <Icon
            name="menu"
            size={30}
            color="black"
            onPress={navigation.toggleDrawer}
            style={{marginLeft: 14}}
          />
        ),
      })}
      drawerContent={props => <CustomDrawer {...props} />}>
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen name="Todos" component={Todos} />
      <Drawer.Screen name="Storage" component={Storage} />
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
