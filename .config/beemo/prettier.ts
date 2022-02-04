import { PrettierConfig } from '@beemo/driver-prettier'

const config: PrettierConfig = {
  ignore: ['esm'],
  useTabs: false,
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'none',
  semi: false
}

export default config
