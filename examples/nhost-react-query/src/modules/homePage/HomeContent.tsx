import { Box } from '@chakra-ui/react'
import Layout from '@modules/layout/Layout'
import { ReactElement } from 'react'

const HomeContent = (): ReactElement => {
  return (
    <Layout>
      <Box data-cy="home">Home</Box>
    </Layout>
  )
}

export default HomeContent
