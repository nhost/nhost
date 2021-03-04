import { Button, Flex } from '@chakra-ui/react'
import { useGQLQuery } from '@hooks/useGQLQuery'
import { auth } from '@libs//nhost'
import UserMenu from '@modules/header/navigation/userMenu/UserMenu'
import { useAuth } from '@nhost/react-auth'
import Link from 'next/link'
import { GetUserByIdQuery, Users } from 'operationTypes'
import { ReactElement, useState } from 'react'
import { GET_USER_BY_ID } from 'src/graphql/operations/queries/userQueries'

const Navbar = (): ReactElement => {
  const [authentictedUser, setAuthenticatedUser] = useState<Users | undefined>()
  const { signedIn } = useAuth()
  const user = auth.user()

  const logout = async (): Promise<void> => {
    await auth.logout()
  }

  const { data, isLoading, error } = useGQLQuery<GetUserByIdQuery>({
    key: ['user', user?.id],
    variables: { id: user?.id },
    query: GET_USER_BY_ID,
    config: {
      enabled: !!user?.id,
    },
  })

  return (
    <Flex gridGap={4}>
      {signedIn && data ? (
        <UserMenu logout={logout} name={data.user?.displayName} avatarSrc={data.user?.avatarUrl} />
      ) : (
        <>
          <Link href="/login">
            <a>
              <Button variant="ghost">Login</Button>
            </a>
          </Link>
          <Link href="/register">
            <a>
              <Button variant="ghost">Register</Button>
            </a>
          </Link>
        </>
      )}
    </Flex>
  )
}

export default Navbar
