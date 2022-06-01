import { Divider } from '@mantine/core'

import AuthLink from '../components/AuthLink'
import EmailPasswordlessForm from '../components/SignUpServerlessForm'

export const EmailPasswordless: React.FC = () => {
  return (
    <>
      <EmailPasswordlessForm />
      <Divider />
      <AuthLink link="/sign-up" variant="white">
        &#8592; Other Registration Options
      </AuthLink>
    </>
  )
}
