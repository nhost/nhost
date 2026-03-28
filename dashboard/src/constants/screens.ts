import type defaultTheme from 'tailwindcss/defaultTheme';
import screens from './screens.cjs';

type Screens = typeof defaultTheme.screens & {
  'xs+': string;
};

export default screens as Screens;
