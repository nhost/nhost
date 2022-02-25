import { Divider, FlexboxGrid, Panel } from 'rsuite'
import { Link, Route, Routes } from 'react-router-dom'
import { OAuth } from './oauth'
import { EmailPasswordless } from './email-passwordless'
import { Password } from './password'
import { VerificationEmailSent } from './verification-email-sent'
export const SignInPage: React.FC = () => {
  return (
    <FlexboxGrid justify="center">
      <FlexboxGrid.Item colspan={12}>
        <Panel header={<h2>Log in to the Application</h2>} bordered>
          <Routes>
            <Route path="/" element={<OAuth />} />
            <Route path="/email-passwordless" element={<EmailPasswordless />} />
            <Route path="/password" element={<Password />} />
            <Route path="/verification-email-sent" element={<VerificationEmailSent />} />
          </Routes>
          <Divider />
          <div style={{ textAlign: 'center' }}>
            Don't have an account? <Link to="/sign-up">Sign up</Link>
          </div>
        </Panel>
      </FlexboxGrid.Item>
    </FlexboxGrid>
  )
}
