import React from 'react'
import { NavLink } from 'react-router-dom'
import { Button } from 'rsuite'

import { EmailPasswordlessForm } from '../components/email-passwordless-form'
export const EmailPasswordless: React.FC = () => {
  return (
    <div>
      <EmailPasswordlessForm />
      <Button as={NavLink} to="/sign-up" block appearance="link">
        &#8592; Other Login Options
      </Button>
    </div>
  )
}
