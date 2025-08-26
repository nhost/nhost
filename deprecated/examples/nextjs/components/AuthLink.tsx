import Link from 'next/link'

import { Button, ButtonVariant } from '@mantine/core'

const AuthLink: React.FC<{
  icon?: React.ReactNode
  link: string
  color?: string
  children?: React.ReactNode
  variant?: ButtonVariant
}> = ({ icon, color, link, variant, children }) => {
  return (
    <Link href={link} passHref>
      <Button
        fullWidth
        radius="sm"
        component="a"
        variant={variant}
        href={link}
        leftIcon={icon}
        styles={(theme) => ({
          root: {
            backgroundColor: color,
            '&:hover': {
              backgroundColor: color && theme.fn.darken(color, 0.05)
            }
          },

          leftIcon: {
            marginRight: 15
          }
        })}
      >
        {children}
      </Button>
    </Link>
  )
}

export default AuthLink
