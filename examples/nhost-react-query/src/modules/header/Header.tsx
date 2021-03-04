import Link from 'next/link'
import { Box, Flex, Grid } from '@chakra-ui/react'
import Navbar from '@modules/header/navigation/Navbar'
import ToggleTheme from '@modules/header/toggleTheme/ToggleTheme'
import React from 'react'

const Header = (): React.ReactElement => {
  return (
    <Grid gridTemplateColumns="1fr 50px" alignItems="center" mt={2}>
      <Flex justifyContent="space-between">
        <Box>
          <Link href="/">
            <a>Avansai</a>
          </Link>
        </Box>
        <Navbar />
      </Flex>
      <ToggleTheme />
    </Grid>
  )
}

export default Header
