import { FaGithub, FaGoogle } from 'react-icons/fa/index.js'

import { useProviderLink } from '@nhost/react'

import AuthLink from './AuthLink'

export default function OauthLinks() {
  const { github, google } = useProviderLink({ redirectTo: window.location.origin })
  return (
    <>
      <AuthLink leftIcon={<FaGithub />} link={github} color="#333">
        Continue with GitHub
      </AuthLink>
      <AuthLink leftIcon={<FaGoogle />} link={google} color="#de5246">
        Continue with Google
      </AuthLink>
    </>
  )
}
