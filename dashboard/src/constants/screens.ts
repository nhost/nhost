import defaultTheme from 'tailwindcss/defaultTheme';

const screens = {
  xs: '415px',
  'xs+': '515px',
  ...defaultTheme.screens,
} as const;

export default screens;
