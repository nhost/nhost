import { Route, Routes } from 'react-router-dom'

// import { AppShell, Button, Group, Header, Image, MantineProvider, Title } from '@mantine/core'
// import { NotificationsProvider } from '@mantine/notifications'

// import { AboutPage } from './About'
// import { ApolloPage } from './apollo'
// import { AuthGate, PublicGate } from './components/auth-gates'
// import NavBar from './components/NavBar'
// import Home from './Home'
// import { ProfilePage } from './profile'
// import { SignInPage } from './sign-in'
// import { SignUpPage } from './sign-up'
// import { StoragePage } from './Storage'

// import './App.css?inline'
// import { NotesPage } from './components/notes'
// import VerifyPage from './Verify'
import './App.css'
import { AuthGate } from './components/auth-gate'
import SignIn from './components/routes/sign-in'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthGate>
            <div>Home</div>
          </AuthGate>
        }
      />
      <Route path="/sign-in">
        <Route path="/" element={<SignIn />} />
        <Route path="/sign-in/email-password" element={<SignInEmailPassword />}></Route>
      </Route>
      {/* <Route
        path="/sign-up/*"
        element={
          <PublicGate anonymous>
            <SignUpPage />
          </PublicGate>
        }
      />
      <Route
        path="/profile"
        element={
          <AuthGate>
            <ProfilePage />
          </AuthGate>
        }
      />

      <Route
        path="/secret-notes"
        element={
          <AuthGate>
            <NotesPage />
          </AuthGate>
        }
      />

      <Route
        path="/storage"
        element={
          <AuthGate>
            <StoragePage />
          </AuthGate>
        }
      />
      <Route
        path="/apollo"
        element={
          <AuthGate>
            <ApolloPage />
          </AuthGate>
        }
      /> */}
    </Routes>
  )
}

export default App
