import { useState } from 'react'
import { FaMinus } from 'react-icons/fa'
import { RemoveSecurityKeyMutation, SecurityKeysQuery } from 'src/generated'

import { ApolloError, useApolloClient, useMutation } from '@apollo/client'
import { ActionIcon, Button, Card, SimpleGrid, Table, TextInput, Title } from '@mantine/core'
import { useInputState } from '@mantine/hooks'
import { showNotification } from '@mantine/notifications'
import { useAddSecurityKey, useUserId } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { REMOVE_SECURITY_KEY, SECURITY_KEYS_LIST } from 'src/utils'

export const SecurityKeys: React.FC = () => {
  const userId = useUserId()
  const client = useApolloClient()
  const { add } = useAddSecurityKey()
  // Nickname of the security key
  const [nickname, setNickname] = useInputState('')
  const [list, setList] = useState<{ id: string; nickname?: string | null }[]>([])

  useAuthQuery<SecurityKeysQuery>(SECURITY_KEYS_LIST, {
    variables: { userId },
    onCompleted: ({ authUserSecurityKeys }) => {
      if (authUserSecurityKeys) {
        setList(authUserSecurityKeys || [])
      }
    }
  })

  const addKey = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const { key, isError, error } = await add(nickname)

    if (isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: error?.message || null
      })
    } else {
      setNickname('')

      // refetch securityKeys so that we know if need to elevate in other components
      await client.refetchQueries({
        include: [SECURITY_KEYS_LIST]
      })
    }
    if (key) {
      setList([...list, key])
    }
  }

  const [removeKey] = useMutation<RemoveSecurityKeyMutation>(REMOVE_SECURITY_KEY, {
    onCompleted: ({ deleteAuthUserSecurityKey }) => {
      if (deleteAuthUserSecurityKey?.id) {
        setList(list.filter((item) => item.id !== deleteAuthUserSecurityKey.id))
      }
    }
  })

  const handleRemoveKey = async (id: string) => {
    try {
      await removeKey({ variables: { id } })

      // refetch securityKeys so that we know if need to elevate in other components
      await client.refetchQueries({
        include: [SECURITY_KEYS_LIST]
      })
    } catch (error) {
      const e = error as ApolloError

      showNotification({
        color: 'red',
        title: 'Error',
        message: e?.message
      })
    }
  }

  return (
    <Card shadow="sm" p="lg" m="sm">
      <Title>Security keys</Title>
      <Table style={{ width: '100%', maxWidth: '100%' }}>
        <colgroup>
          <col />
          <col width="20%" />
        </colgroup>
        <tbody>
          {list.map(({ id, nickname }) => (
            <tr key={id}>
              <td>{nickname || id}</td>
              <td>
                <ActionIcon onClick={() => handleRemoveKey(id)} color="red">
                  <FaMinus />
                </ActionIcon>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <form onSubmit={addKey}>
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
