import { Spinner, Flex } from '@chakra-ui/react'
import { ReactElement } from 'react'

const FullPageLoader = (): ReactElement => {
  return (
    <Flex width="full" height="100vh" justifyContent="center" alignItems="center">
      <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" />
    </Flex>
  )
}

export default FullPageLoader
