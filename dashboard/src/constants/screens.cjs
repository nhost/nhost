const defaultTheme = require('tailwindcss/defaultTheme');

const screens = {
  xs: '415px',
  'xs+': '515px',
  ...defaultTheme.screens,
};

module.exports = screens;
