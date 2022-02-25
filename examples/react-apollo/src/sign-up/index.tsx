import { Divider, FlexboxGrid, Panel } from 'rsuite'
import { useEmailPasswordSignUp } from '@nhost/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export const SignUpPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signUp, ...signUpResult } = useEmailPasswordSignUp(email, password)
  return (
    <FlexboxGrid justify="center">
      <FlexboxGrid.Item colspan={12}>
        <Panel header={<h2>Sign up</h2>} bordered>
          <p>TODO</p>
          <ul>
            <li>Email + password. Add tooltips to show invalid values</li>
            <li>Passwordless email</li>
            <li>Passwordless SMS</li>
            <li>OAuth</li>
            <li>
              For all of the above, show how to include personal information in the registration
              process
            </li>
          </ul>
          {/* <Routes>
          <Route path="/" element={<OAuth />} />
          <Route path="/email-passwordless" element={<EmailPasswordless />} />
          <Route path="/password" element={<Password />} />
          <Route path="/verification-email-sent" element={<VerificationEmailSent />} />
        </Routes> */}
          <Divider />
          <div style={{ textAlign: 'center' }}>
            Already have an account? <Link to="/sign-in">Log in</Link>
          </div>
        </Panel>
      </FlexboxGrid.Item>
    </FlexboxGrid>
  )
}
