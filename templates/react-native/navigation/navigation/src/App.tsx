import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/nhost/AuthProvider';
import { screens } from '@/screens';
import '../global.css';

const Stack = createNativeStackNavigator();

/**
 * Deep links, mapped the way the screens are named.
 *
 * A screen's name is its path, so the mapping is the identity with the leading
 * slash taken off - which is what lets an auth email reopen the app on the
 * screen its link points at. Expo Router does this from the file tree; here it
 * is the same list, read once.
 */
const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: Object.fromEntries(
      screens.map(({ name }) => [name, name.replace(/^\//, '')]),
    ),
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <NavigationContainer linking={linking}>
          <Stack.Navigator
            initialRouteName="/"
            screenOptions={{ title: 'Nhost' }}
          >
            {screens.map(({ name, component }) => (
              <Stack.Screen key={name} name={name} component={component} />
            ))}
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
