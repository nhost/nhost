import { Route, Routes } from 'react-router-dom'

import { AppShell, Header, MantineProvider } from '@mantine/core'
import { NotificationsProvider } from '@mantine/notifications'

import { AuthGate, PublicGate } from './components/auth-gates'
import NavBar from './components/NavBar'
import { AboutPage } from './About'
import { ApolloPage } from './apollo'
import Home from './Home'
import { ProfilePage } from './profile'
import { SignInPage } from './sign-in'
import { SignUpPage } from './sign-up'

import './App.css'
const title = 'Nhost with React and Apollo'

function App() {
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
