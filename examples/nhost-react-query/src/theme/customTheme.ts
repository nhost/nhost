import { extendTheme, ColorModeOptions } from '@chakra-ui/react'

const config: ColorModeOptions = {
  useSystemColorMode: false,
  initialColorMode: 'dark',
}

const customTheme = extendTheme({ config })

export default customTheme
