import { Panel } from 'rsuite'
import { useEmailPasswordSignUp } from '@nhost/react'
import { useState } from 'react'

export const SignUpPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signUp, ...signUpResult } = useEmailPasswordSignUp(email, password)
  return (
    <Panel header="Sign up">
      <p>TODO</p>
      <ul>
        <li>Email + password. Add tooltips to show invalid values</li>
        <li>Passwordless email</li>
        <li>Passwordless SMS</li>
        <li>OAuth</li>
        <li>
          For all of the above, show how to include personal information in the registration process
        </li>
      </ul>
    </Panel>
  )
}
