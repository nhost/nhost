import { FaMinus } from 'react-icons/fa'

import { ActionIcon, Button, Card, SimpleGrid, Table, TextInput, Title } from '@mantine/core'
import { useInputState } from '@mantine/hooks'
import { useSecurityKeys } from '@nhost/react'

export const SecurityKeys: React.FC = () => {
  const { list, add, remove } = useSecurityKeys()
  const [nickname, setNickname] = useInputState('')
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
                <ActionIcon onClick={() => remove(id)} color="red">
                  <FaMinus />
                </ActionIcon>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const { error } = await add(nickname)
          if (error) {
            console.log(error)
          } else {
            setNickname('')
          }
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
