import { Route, Routes } from 'react-router-dom'
import { AuthGate } from '@/components/auth/auth-gate'
import Home from '@/components/routes/app/home'
import Layout from '@/components/routes/app/layout'
import Profile from '@/components/routes/app/profile'
import ProtectedNotes from '@/components/routes/app/protected-notes'
import Storage from '@/components/routes/app/storage'
import Todos from '@/components/routes/app/todos'
import ForgotPassword from '@/components/routes/auth/forgot-password'
import SignIn from '@/components/routes/auth/sign-in/sign-in'
import SignInEmailPassword from '@/components/routes/auth/sign-in/sign-in-email-password'
import SignInMagicLink from '@/components/routes/auth/sign-in/sign-in-magic-link'
import SignInSecurityKey from '@/components/routes/auth/sign-in/sign-in-security-key'
import SignUp from '@/components/routes/auth/sign-up/sign-up'
import SignUpEmailPassword from '@/components/routes/auth/sign-up/sign-up-email-password'
import SignUpMagicLink from '@/components/routes/auth/sign-up/sign-up-magic-link'
import SignUpSecurityKey from '@/components/routes/auth/sign-up/sign-up-security-key'
import VerifyEmail from './components/routes/auth/verify-email'
import SignInEmailOTP from './components/routes/auth/sign-in/sign-in-email-otp'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthGate>
            <Layout />
          </AuthGate>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/protected-notes" element={<ProtectedNotes />} />
        <Route path="/storage" element={<Storage />} />
        <Route path="/todos" element={<Todos />} />
      </Route>

      <Route path="/sign-in">
        <Route path="/sign-in/" element={<SignIn />} />
        <Route path="/sign-in/email-password" element={<SignInEmailPassword />} />
        <Route path="/sign-in/security-key" element={<SignInSecurityKey />} />
        <Route path="/sign-in/magic-link" element={<SignInMagicLink />} />
        <Route path="/sign-in/email-otp" element={<SignInEmailOTP />} />
        <Route path="/sign-in/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route path="/sign-up">
        <Route path="/sign-up/" element={<SignUp />} />
        <Route path="/sign-up/email-password" element={<SignUpEmailPassword />} />
        <Route path="/sign-up/security-key" element={<SignUpSecurityKey />} />
        <Route path="/sign-up/magic-link" element={<SignUpMagicLink />} />
      </Route>

      <Route path="/verify" element={<VerifyEmail />} />
    </Routes>
  )
}

export default App
