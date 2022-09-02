import { FaMinus } from 'react-icons/fa'
import { MyAuthenticatorsQuery, RemoveAuthenticatorMutation } from 'src/generated'

import { gql, useMutation, useQuery } from '@apollo/client'
import { ActionIcon, Button, Card, SimpleGrid, Table, TextInput, Title } from '@mantine/core'
import { useInputState } from '@mantine/hooks'
import { useNhostClient, useUserId } from '@nhost/react'

const GET_AUTHENTICATORS = gql`
  query myAuthenticators {
    authUserAuthenticators {
      id
      nickname
    }
  }
`

const REMOVE_AUTHENTICATOR = gql`
  mutation removeAuthenticator($id: uuid!) {
    deleteAuthUserAuthenticator(id: $id) {
      id
    }
  }
`
export const SecurityKeys: React.FC = () => {
  const nhost = useNhostClient()
  const id = useUserId()
  const { data, refetch } = useQuery<MyAuthenticatorsQuery>(GET_AUTHENTICATORS, {
    variables: { id }
  })
  const [remove] = useMutation<RemoveAuthenticatorMutation>(REMOVE_AUTHENTICATOR, {
    refetchQueries: ['myAuthenticators']
  })
  const [nickname, setNickname] = useInputState('')
  return (
    <Card shadow="sm" p="lg" m="sm">
      <Title>Security keys</Title>
      {data?.authUserAuthenticators && (
        <Table style={{ width: '100%', maxWidth: '100%' }}>
          <colgroup>
            <col />
            <col width="20%" />
          </colgroup>
          <tbody>
            {data.authUserAuthenticators.map(({ id, nickname }) => (
              <tr key={id}>
                <td>{nickname || id}</td>
                <td>
                  <ActionIcon onClick={() => remove({ variables: { id } })} color="red">
                    <FaMinus />
                  </ActionIcon>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          // TODO catch errors
          await nhost.auth.addSecurityKey(nickname)
          setNickname('')
          refetch()
        }}
      >
        <SimpleGrid cols={2}>
          <TextInput
            autoFocus
            value={nickname}
            onChange={setNickname}
            placeholder="Nickname for the device (optional)"
          />
          <Button type="submit">Add a new device</Button>
        </SimpleGrid>
      </form>
    </Card>
  )
}
