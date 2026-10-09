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
 * Each screen is matched by its path, which is what lets an auth email reopen
 * the app on the screen its link points at. Expo Router does this from the
 * file tree; here it is the same list, read once. `useGo()` reads a path
 * through this too, so going somewhere and being linked there agree.
 */
const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: Object.fromEntries(screens.map(({ name, path }) => [name, path])),
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
