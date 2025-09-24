import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './src/root';
import {name as appName} from './app.json';
import {decode as atob} from 'base-64';
global.atob = atob;

AppRegistry.registerComponent(appName, () => App);
