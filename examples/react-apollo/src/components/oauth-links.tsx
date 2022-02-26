import { IconButton } from 'rsuite'
import { FaGithub, FaGoogle, FaFacebook } from 'react-icons/fa'
import { Icon } from '@rsuite/icons'

export const OAuthLinks: React.FC = () => (
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
  </div>
)
