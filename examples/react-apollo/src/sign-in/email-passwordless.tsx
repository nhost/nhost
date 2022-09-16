import { Divider } from '@mantine/core'

import AuthLink from '../components/AuthLink'
import PasswordlessForm from '../components/SignInPasswordlessForm'

export const EmailPasswordless: React.FC = () => {
  return (
    <>
      <PasswordlessForm />
      <Divider />
      <AuthLink link="/sign-up" variant="white">
        &#8592; Other Login Options
      </AuthLink>
    </>
  )
}
