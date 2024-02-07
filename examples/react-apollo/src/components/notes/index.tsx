import {
  DeleteNoteMutation,
  InsertNoteMutation,
  NotesListQuery,
  SecurityKeysQuery
} from 'src/generated'

import { gql, useMutation } from '@apollo/client'
import {
  Button,
  Card,
  Container,
  Grid,
  Loader,
  TextInput,
  Title,
  Group,
  ActionIcon
} from '@mantine/core'
import { useInputState } from '@mantine/hooks'
import { showNotification } from '@mantine/notifications'
import { useAuthQuery } from '@nhost/react-apollo'
import { useElevateSecurityKeyEmail, useUserData } from '@nhost/react'
import { FaTrash } from 'react-icons/fa'
import { SECURITY_KEYS_LIST } from 'src/utils'
import { useState } from 'react'

const NOTES_LIST = gql`
  query notesList {
    notes {
      id
      content
    }
  }
`

const INSERT_NOTE = gql`
  mutation insertNote($content: String!) {
    insertNote(object: { content: $content }) {
      id
      content
    }
  }
`

const DELETE_NOTE = gql`
  mutation deleteNote($noteId: uuid!) {
    deleteNote(id: $noteId) {
      id
      content
    }
  }
`

export const NotesPage: React.FC = () => {
  const userData = useUserData()

  const { loading, data } = useAuthQuery<NotesListQuery>(NOTES_LIST, {
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  })

  const [content, setContent] = useInputState('')
  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()

  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)

  useAuthQuery<SecurityKeysQuery>(SECURITY_KEYS_LIST, {
    variables: { userId: userData?.id },
    onCompleted: ({ authUserSecurityKeys }) => {
      setUserHasSecurityKey(authUserSecurityKeys?.length > 0)
    }
  })

  const [addNoteMutation] = useMutation<InsertNoteMutation>(INSERT_NOTE)
  const [deleteNoteMutation] = useMutation<DeleteNoteMutation>(DELETE_NOTE)

  const checkElevatedPermission = async () => {
    if (!elevated && userHasSecurityKey) {
      const { elevated } = await elevateEmailSecurityKey(userData?.email as string)

      if (!elevated) {
        throw new Error('Permissions were not elevated')
      }
    }
  }

  const add = async () => {
    if (!content) return

    try {
      await checkElevatedPermission()
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Could not elevate permissions'
      })

      return
    }

    addNoteMutation({
      variables: { content },
      onCompleted: () => setContent(''),
      onError: (error) => {
        showNotification({
          color: 'red',
          title: error.networkError ? 'Network error' : 'Error',
          message: error.message
        })
      },
      update: (cache, { data }) => {
        cache.modify({
          fields: {
            notes(existingNotes = []) {
              const newNoteRef = cache.writeFragment({
                data: data?.insertNote,
                fragment: gql`
                  fragment NewNote on notes {
                    id
                    content
                  }
                `
              })
              return [...existingNotes, newNoteRef]
            }
          }
        })
      }
    })
  }

  const deleteNote = async (noteId: string) => {
    if (!noteId) return

    try {
      await checkElevatedPermission()
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Could not elevate permissions'
      })

      return
    }

    deleteNoteMutation({
      variables: { noteId },
      onCompleted: () => setContent(''),
      onError: (error) => {
        showNotification({
          color: 'red',
          title: error.networkError ? 'Network error' : 'Error',
          message: error.message
        })
      },
      update: (cache, { data }) => {
        const deletedNoteId = data?.deleteNote?.id
        if (deletedNoteId) {
          cache.modify({
            fields: {
              notes(existingNotes = [], { readField }) {
                // @ts-ignore
                return existingNotes.filter((noteRef) => noteId !== readField('id', noteRef))
              }
            }
          })
        }
      }
    })
  }

  return (
    <Container>
      {loading && <Loader />}
      <Card shadow="sm" p="lg" m="sm">
        <Title>Secret Notes</Title>
        <Grid>
          <Grid.Col span={10}>
            <TextInput
              value={content}
              onChange={setContent}
              autoFocus
              onKeyDown={(e) => e.code === 'Enter' && add()}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Button
              fullWidth
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                add()
              }}
            >
              Add
            </Button>
          </Grid.Col>
        </Grid>
        <ul style={{ paddingLeft: 12 }}>
          {data?.notes.map((note) => (
            <li key={note.id}>
              <Group position="apart">
                <span>{note.content}</span>
                <ActionIcon
                  size={21}
                  onClick={(event) => {
                    event.preventDefault()
                    deleteNote(note.id)
                  }}
                >
                  <FaTrash />
                </ActionIcon>
              </Group>
            </li>
          ))}
        </ul>
      </Card>
    </Container>
  )
}
