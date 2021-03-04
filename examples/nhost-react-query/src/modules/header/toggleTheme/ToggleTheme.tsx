import React from 'react'
import { useColorMode, useColorModeValue } from '@chakra-ui/react'
import { FiMoon, FiSun } from 'react-icons/fi'
import ToggleIconButton from '@components/toggleIconButton/ToggleIconButton'

const ToggleTheme = (): React.ReactElement => {
  const { colorMode, toggleColorMode } = useColorMode()
  // Since some chakra-ui components aren't compatible dark mode
  // we need to handle the color
  const iconColor = useColorModeValue('gray.700', 'gray.200')
  return (
    <ToggleIconButton
      toggle={toggleColorMode}
      aria-label="Toggle Theme Color"
      icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
      color={iconColor}
      data-testid="toggle-theme"
    />
  )
}

export default ToggleTheme
