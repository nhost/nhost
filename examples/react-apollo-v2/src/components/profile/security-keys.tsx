// import { gql, useApolloClient } from '@apollo/client'
// import { useAddSecurityKey, useUserId } from '@nhost/react'
// import { useState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { useAuthQuery } from '@nhost/react-apollo'
import { gql } from '@apollo/client'
import { useState } from 'react'
import { useUserId } from '@nhost/react'

type SecurityKey = {
  id: string
  nickname: string | null
}

type SecurityKeysQuery = {
  authUserSecurityKeys: SecurityKey[]
}

export default function SecurityKeys() {
  const userId = useUserId()
  // const client = useApolloClient()
  // const { add } = useAddSecurityKey()

  // Nickname of the security key
  // const [nickname, setNickname] = useState('')
  const [list, setList] = useState<SecurityKey[]>([])

  useAuthQuery<SecurityKeysQuery>(
    gql`
      query securityKeys($userId: uuid!) {
        authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
          id
          nickname
        }
      }
    `,
    {
      variables: { userId },
      onCompleted: ({ authUserSecurityKeys }) => {
        if (authUserSecurityKeys) {
          setList(authUserSecurityKeys || [])
        }
      }
    }
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Security keys</CardTitle>
        <CardDescription>
          You are authenticated. You have now access to the authorised part of the application.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
