import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Tailwind breakpoints: the defaults plus `xs` and `xs+`. Shared by
 * tailwind.config.ts and `useMediaQuery`.
 */
const screens = {
  xs: '415px',
  'xs+': '515px',
  ...defaultTheme.screens,
};

export default screens;
