import { Divider } from '@mantine/core'

import AuthLink from '../components/AuthLink'
import PasswordlessForm from '../components/SignInPasswordlessForm'

export const EmailPasswordless: React.FC = () => {
  return (
    <>
      <PasswordlessForm />
      <Divider />
      <AuthLink link="/sign-in" variant="white">
        &#8592; Other Sign-in Options
      </AuthLink>
    </>
  )
}
