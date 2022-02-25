import './App.css'

import { useAuthenticated, useSignOut } from '@nhost/react'
import ExitIcon from '@rsuite/icons/Exit'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { Container, Header, Navbar, Content, Nav } from 'rsuite'
import { useEffect } from 'react'
import { SignInPage } from './sign-in'
import { AuthGate } from './auth-gates'
import Home from './Home'
import { ProfilePage } from './profile'
import { ApolloPage } from './apollo'
import { SignUpPage } from './sign-up'

function App() {
  const isAuthenticated = useAuthenticated()
  const { signOut, isSuccess: signedOut } = useSignOut()

  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (signedOut) {
      navigate('/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedOut])
  return (
    <Container>
      <Header>
        <Navbar appearance="inverse">
          <Navbar.Brand as="div">
            <Link to="/">
              <img src="/logo.svg" alt="logo" style={{ maxHeight: '100%' }} />
            </Link>
          </Navbar.Brand>
          <Nav activeKey={location.pathname} onSelect={navigate}>
            {isAuthenticated && <Nav.Item eventKey="/profile">Profile</Nav.Item>}
            {isAuthenticated && <Nav.Item eventKey="/apollo">Apollo GraphQL</Nav.Item>}
          </Nav>
          <Nav pullRight>
            {isAuthenticated && (
              <Nav.Item icon={<ExitIcon />} onSelect={signOut}>
                Sign out
              </Nav.Item>
            )}
          </Nav>
        </Navbar>
      </Header>
      <Content>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
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
      </Content>
    </Container>
  )
}

export default App
