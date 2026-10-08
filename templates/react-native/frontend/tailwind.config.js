/** @type {import('tailwindcss').Config} */
module.exports = {
  // Every file that can carry a className. Metro does not tell Tailwind what
  // it bundled, so this list is what decides which utilities are generated.
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
