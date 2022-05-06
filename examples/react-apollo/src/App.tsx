/* eslint-disable react/react-in-jsx-scope */
import { useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { useAuthenticated, useSignOut } from '@nhost/react'

import { AuthGate, PublicGate } from './components/auth-gates'
import { AboutPage } from './About'
import { ApolloPage } from './apollo'
import Home from './Home'
import { ProfilePage } from './profile'
import { SignInPage } from './sign-in'
import { SignUpPage } from './sign-up'

import './App.css'
import NavBar from './components/NavBar'
import { MantineProvider, AppShell, Header } from '@mantine/core'
import { NotificationsProvider } from '@mantine/notifications'
const title = 'Nhost with React and Apollo'

function App() {
  const isAuthenticated = useAuthenticated()
  const { signOut, isSuccess: signedOut } = useSignOut()

  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (signedOut) navigate('/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedOut])
  return (
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        /** Put your mantine theme override here */
        colorScheme: 'light'
      }}
    >
      <NotificationsProvider>
        <AppShell
          padding="md"
          navbar={<NavBar />}
          header={
            <Header height={60} p="xs">
              {title}
            </Header>
          }
          styles={(theme) => ({
            main: {
              backgroundColor:
                theme.colorScheme === 'dark' ? theme.colors.dark[8] : theme.colors.gray[0]
            }
          })}
        >
          <Routes>
            <Route
              path="/"
              element={
                <AuthGate>
                  <Home />
                </AuthGate>
              }
            />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/sign-in/*"
              element={
                <PublicGate>
                  <SignInPage />
                </PublicGate>
              }
            />
            <Route
              path="/sign-up/*"
              element={
                <PublicGate>
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
              path="/apollo"
              element={
                <AuthGate>
                  <ApolloPage />
                </AuthGate>
              }
            />
          </Routes>
        </AppShell>
      </NotificationsProvider>
    </MantineProvider>
  )
}

export default App
