import { DeleteNoteMutation, InsertNoteMutation, NotesListQuery } from 'src/generated'

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

  const { elevateEmailSecurityKey, elevated } = useElevateSecurityKeyEmail()

  const [addNoteMutation] = useMutation<InsertNoteMutation>(INSERT_NOTE)
  const [deleteNoteMutation] = useMutation<DeleteNoteMutation>(DELETE_NOTE)

  const add = () => {
    if (!content) return

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

  const deleteNote = (noteId: string) => {
    if (!noteId) return

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
        <Group position="apart">
          <span>Elevated permissions: {String(elevated)}</span>
          <Button
            onClick={async (e: React.MouseEvent) => {
              if (userData?.email) {
                await elevateEmailSecurityKey(userData.email)
              }
            }}
          >
            Elevate
          </Button>
        </Group>
      </Card>
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
