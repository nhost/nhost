import { Route, Routes } from 'react-router-dom'
import { BrandGithub } from 'tabler-icons-react'

import { AppShell, Button, Group, Header, Image, MantineProvider, Title } from '@mantine/core'
import { NotificationsProvider } from '@mantine/notifications'

import { AboutPage } from './About'
import { ApolloPage } from './apollo'
import { AuthGate, PublicGate } from './components/auth-gates'
import NavBar from './components/NavBar'
import Home from './Home'
import { ProfilePage } from './profile'
import { SignInPage } from './sign-in'
import { SignUpPage } from './sign-up'
import { StoragePage } from './Storage'

import './App.css?inline'
import { NotesPage } from './components/notes'
const title = 'Nhost with React and Apollo'

function App() {
  const colorScheme = 'light'
  return (
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        colorScheme
      }}
    >
      <NotificationsProvider>
        <AppShell
          padding="md"
          navbar={<NavBar />}
          header={
            <Header height={60} p="xs">
              <Group position="apart" noWrap>
                <Group noWrap>
                  <Image src="/logo.svg" height={35} fit="contain" width={120} />
                  <Title order={3} style={{ whiteSpace: 'nowrap' }}>
                    {title}
                  </Title>
                </Group>
                <Button
                  leftIcon={<BrandGithub />}
                  variant="outline"
                  color={colorScheme}
                  component="a"
                  href="https://github.com/nhost/nhost/tree/main/examples/react-apollo"
                  target="_blank"
                >
                  GitHub
                </Button>
              </Group>
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
            />
          </Routes>
        </AppShell>
      </NotificationsProvider>
    </MantineProvider>
  )
}

export default App
