import { Route, Routes } from 'react-router-dom'

import { AuthGate } from '@/components/auth-gate'
import Layout from '@/components/routes/app/layout'
import ForgotPassword from '@/components/routes/auth/forgot-password'
import SignUpEmailPassword from '@/components/routes/auth/sign-up/sign-up-email-password'
import SignIn from '@/components/routes/sign-in'
import SignInEmailPassword from '@/components/routes/sign-in-email-password'
import SignUp from '@/components/routes/sign-up'
import Profile from './components/routes/app/profile'

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
        <Route path="/" element={<Profile />} />
      </Route>

      <Route path="/sign-in">
        <Route path="/sign-in/" element={<SignIn />} />
        <Route path="/sign-in/email-password" element={<SignInEmailPassword />}></Route>
        <Route path="/sign-in/forgot-password" element={<ForgotPassword />}></Route>
      </Route>

      <Route path="/sign-up">
        <Route path="/sign-up/" element={<SignUp />} />
        <Route path="/sign-up/email-password" element={<SignUpEmailPassword />}></Route>
      </Route>
    </Routes>
  )
}

export default App
