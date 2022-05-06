import { Container, Title } from '@mantine/core'
import React from 'react'

const HomePage: React.FC = () => {
  return (
    <Container>
      <Title>Home page</Title>
      You are authenticated. You have now access to the authorised part of the application.
    </Container>
  )
}
export default HomePage
