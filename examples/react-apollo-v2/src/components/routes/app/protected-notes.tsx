import { gql, useMutation } from '@apollo/client'
import { useElevateSecurityKeyEmail, useUserData } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { Info, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { SECURITY_KEYS_LIST } from '../../gql/security-keys'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Input } from '../../ui/input'
import { Separator } from '../../ui/separator'

type NotesListQuery = {
  notes: {
    id: string
    content: string
  }[]
}

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

export default function ProtectedNotes() {
  const userData = useUserData()
  const { data, refetch: refetchNotes } = useAuthQuery<NotesListQuery>(NOTES_LIST)

  const [content, setContent] = useState('')
  const [userHasSecurityKey, setUserHasSecurityKey] = useState(false)
  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()

  useAuthQuery<{
    authUserSecurityKeys: {
      id: string
      nickname?: string
    }[]
  }>(SECURITY_KEYS_LIST, {
    variables: { userId: userData?.id },
    onCompleted: ({ authUserSecurityKeys }) => {
      setUserHasSecurityKey(authUserSecurityKeys?.length > 0)
    }
  })

  const [addNoteMutation] = useMutation<{
    insertNote?: {
      id: string
      content: string
    }
  }>(INSERT_NOTE)

  const [deleteNoteMutation] = useMutation<{
    deleteNote?: {
      id: string
      content: string
    }
  }>(DELETE_NOTE)

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
    } catch {
      toast.error('Could not elevate permissions')

      return
    }

    addNoteMutation({
      variables: { content },
      onCompleted: async () => {
        setContent('')
        await refetchNotes()
      },
      onError: (error) => {
        toast.error(error.message)
      }
    })
  }

  const deleteNote = async (noteId: string) => {
    if (!noteId) return

    try {
      await checkElevatedPermission()
    } catch {
      toast.error('Could not elevate permissions')

      return
    }

    deleteNoteMutation({
      variables: { noteId },
      onCompleted: async () => {
        setContent('')
        await refetchNotes()
      },
      onError: (error) => {
        toast.error(error.message)
      }
    })
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Protected Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-row gap-4">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.code === 'Enter' && add()}
          />
          <Button className="m-0" onClick={() => add()}>
            <Plus />
            Add
          </Button>
        </div>

        <div>
          {data?.notes.length === 0 && (
            <Alert className="w-full">
              <Info className="w-4 h-4" />
              <AlertTitle>Empty</AlertTitle>
              <AlertDescription className="mt-2">Start by adding a note</AlertDescription>
            </Alert>
          )}
          {data?.notes.map((note) => (
            <>
              <div key={note.id} className="flex flex-row items-center justify-between w-full p-4">
                <div className="flex flex-row gap-2">
                  <span>{note.content}</span>
                </div>

                <Button variant="ghost" onClick={() => deleteNote(note.id)}>
                  <Trash className="w-5 h-5" />
                </Button>
              </div>

              <Separator className="last:hidden" />
            </>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
