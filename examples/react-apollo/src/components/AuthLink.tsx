import { Link } from 'react-router-dom'

import { Button, ButtonProps, SharedButtonProps } from '@mantine/core'

const AuthButton: <C = 'button'>(props: ButtonProps<C>) => React.ReactElement = ({
  color,
  ...rest
}) => (
  <Button
    role="button"
    fullWidth
    radius="sm"
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
    {...rest}
  />
)

const AuthLink: React.FC<
  SharedButtonProps & {
    link: string
  }
> = ({ link, ...rest }) => {
  const isExternal = link.startsWith('http://') || link.startsWith('https://')
  return isExternal ? (
    <AuthButton component={'a'} href={link} {...rest} />
  ) : (
    <AuthButton component={Link} to={link} {...rest} />
  )
}

export default AuthLink
