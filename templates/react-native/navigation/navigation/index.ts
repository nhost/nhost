import { registerRootComponent } from 'expo';
import App from './src/App';

// Expo Router registers its own root; this navigation system has an app of its
// own, so it does the registering.
registerRootComponent(App);
