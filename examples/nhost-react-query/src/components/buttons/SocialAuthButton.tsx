import { Image, Link } from '@chakra-ui/react'
import { ReactElement } from 'react'

interface SocialAuthButtonProps {
  provider: 'google' | 'linkedin'
  imgSrc
  imgAlt
}

const SocialAuthButton = ({ provider, imgAlt, imgSrc }: SocialAuthButtonProps): ReactElement => (
  <Link href={`https://backend-1ca97587.nhost.app/auth/providers/${provider}`}>
    <Image src={imgSrc} alt={imgAlt} w={400} />
  </Link>
)

export default SocialAuthButton
