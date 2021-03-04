import React from 'react'
import { Container } from '@chakra-ui/react'
import Header from '@modules/header/Header'

interface LayoutProps {
  children: React.ReactNode
}
const Layout = ({ children }: LayoutProps): React.ReactElement => (
  <Container maxW="1200px" data-cy="layout">
    <Header />
    {children}
  </Container>
)

export default Layout
