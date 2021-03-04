import React from 'react'
import { IconButton, IconButtonProps } from '@chakra-ui/react'

interface ToggleButtonProps extends IconButtonProps {
  toggle: () => void
  icon: React.ReactElement
}
const ToggleIconButton = ({
  toggle,
  icon,
  ...iconProps
}: ToggleButtonProps): React.ReactElement => {
  return (
    <IconButton
      colorScheme="light"
      size="lg"
      onClick={toggle}
      icon={icon}
      {...iconProps}
      role="button"
    />
  )
}

export default ToggleIconButton
