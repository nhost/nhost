import { Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/auth-gate'
import Home from './components/routes/app/home'
import Layout from './components/routes/app/layout'
import Profile from './components/routes/app/profile'
import ForgotPassword from './components/routes/auth/forgot-password'
import SignIn from './components/routes/auth/sign-in'
import SignInEmailPassword from './components/routes/auth/sign-in-email-password'
import SignUp from './components/routes/auth/sign-up'

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
      </Route>

      <Route path="/sign-in">
        <Route path="/sign-in/" element={<SignIn />} />
        <Route path="/sign-in/email-password" element={<SignInEmailPassword />}></Route>
        <Route path="/sign-in/forgot-password" element={<ForgotPassword />}></Route>
      </Route>

      <Route path="/sign-up">
        <Route path="/sign-up/" element={<SignUp />} />
        <Route path="/sign-up/email-password" element={<SignInEmailPassword />}></Route>
      </Route>
    </Routes>
  )
}

export default App
