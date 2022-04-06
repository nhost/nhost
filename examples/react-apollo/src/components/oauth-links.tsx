/* eslint-disable react/react-in-jsx-scope */
import { FaFacebook, FaGithub, FaGoogle } from 'react-icons/fa'
import { IconButton } from 'rsuite'

import { useProviderLink } from '@nhost/react'
import { Icon } from '@rsuite/icons'

export const OAuthLinks: React.FC = () => {
  // TODO show how to use options
  const { github, google, facebook } = useProviderLink()
  return (
    <div>
      <IconButton
        icon={<Icon as={FaGithub} style={{ backgroundColor: 'black' }} />}
        as="a"
        href={github}
        block
        appearance="primary"
        style={{ backgroundColor: 'black' }}
      >
        Continue with GitHub
      </IconButton>
      <IconButton
        icon={<Icon as={FaGoogle} />}
        as="a"
        href={google}
        block
        appearance="primary"
        color="red"
      >
        Continue with Google
      </IconButton>
      <IconButton
        icon={<Icon as={FaFacebook} />}
        as="a"
        href={facebook}
        block
        appearance="primary"
        color="blue"
      >
        Continue with Facebook
      </IconButton>
    </div>
  )
}
