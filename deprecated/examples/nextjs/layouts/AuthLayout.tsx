import { Card, Container, Divider, SimpleGrid, Title } from '@mantine/core'

export const AuthLayout: React.FC<{
  title?: string
  footer?: React.ReactNode
  children: React.ReactNode
}> = ({ title, footer, children }) => {
  return (
    <Container>
      <Card shadow="sm" p="lg" m="lg">
        {title && <Title p="lg">{title}</Title>}
        <SimpleGrid cols={1} spacing={6}>
          {children}
        </SimpleGrid>
      </Card>
      {footer && (
        <>
          <Divider my="sm" />
          {footer}
        </>
      )}
    </Container>
  )
}

export default AuthLayout
