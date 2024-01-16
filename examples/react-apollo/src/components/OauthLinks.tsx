import { FaApple, FaGithub, FaGoogle, FaLinkedin } from 'react-icons/fa/index.js'

import { useProviderLink } from '@nhost/react'

import AuthLink from './AuthLink'

export default function OauthLinks() {
  const { github, google, apple, linkedin } = useProviderLink({
    redirectTo: window.location.origin
  })

  return (
    <>
      <AuthLink leftIcon={<FaGithub />} link={github} color="#333">
        Continue with GitHub
      </AuthLink>
      <AuthLink leftIcon={<FaGoogle />} link={google} color="#de5246">
        Continue with Google
      </AuthLink>
      <AuthLink leftIcon={<FaApple />} link={apple} color="#333333">
        Sign In With Apple
      </AuthLink>

      <AuthLink leftIcon={<FaLinkedin />} link={linkedin} color="#0073B1">
        Sign In With LinkedIn
      </AuthLink>
    </>
  )
}
