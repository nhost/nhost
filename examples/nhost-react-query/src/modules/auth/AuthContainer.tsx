import { ReactElement, ReactNode } from 'react'
import { Container, Stack } from '@chakra-ui/react'

interface AuthContainerProps {
  children: ReactNode
}
const AuthContainer = ({ children }: AuthContainerProps): ReactElement => (
  <Container
    maxW={400}
    shadow="md"
    py={4}
    mt={8}
    border="1px"
    borderColor="gray.400"
    borderRadius="lg"
  >
    <Stack direction="column" spacing={8}>
      {children}
    </Stack>
  </Container>
)

export default AuthContainer
