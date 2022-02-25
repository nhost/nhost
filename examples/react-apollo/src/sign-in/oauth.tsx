import { Button, IconButton, Divider } from 'rsuite'
import { FaGithub, FaGoogle, FaFacebook, FaLock } from 'react-icons/fa'
import { Icon } from '@rsuite/icons'
import { NavLink } from 'react-router-dom'

export const OAuth: React.FC = () => (
  <div>
    <IconButton
      block
      icon={<Icon as={FaGithub} style={{ backgroundColor: 'black' }} />}
      appearance="primary"
      style={{ backgroundColor: 'black' }}
    >
      Continue with GitHub
    </IconButton>
    <IconButton block icon={<Icon as={FaGoogle} />} appearance="primary" color="red">
      Continue with Google
    </IconButton>
    <IconButton block icon={<Icon as={FaFacebook} />} appearance="primary" color="blue">
      Continue with Facebook
    </IconButton>
    <Divider />
    <IconButton
      block
      icon={<Icon as={FaLock} />}
      appearance="ghost"
      as={NavLink}
      to="/sign-in/email-passwordless"
    >
      Continue with passwordless email
    </IconButton>
    <Button as={NavLink} to="/sign-in/password" block appearance="link">
      Continue with email + password
    </Button>
  </div>
)
