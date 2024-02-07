import { gql, useSubscription } from '@apollo/client'
import { getNhostSession, useAuthenticated, useSignOut, useUserData } from '@nhost/nextjs'
import { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { useRouter } from 'next/router'

interface Note {
  id: string
  content: string
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const nhostSession = await getNhostSession({ subdomain: 'local' }, context)
  return {
    props: {
      nhostSession
    }
  }
}

export default function Todos({
  nhostSession
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter()
  const userData = useUserData()
  const isAuthenticated = useAuthenticated()

  console.log({
    isAuthenticated,
    nhostSession
  })

  const { signOut } = useSignOut()

  const { loading, error, data } = useSubscription<{ notes: Note[] }>(gql`
    subscription subscribeToNotes {
      notes {
        id
        content
      }
    }
  `)

  console.log({
    loading,
    error,
    data
  })

  const handleSignOut = async () => {
    const res = await signOut()

    console.log({
      res
    })

    if (res.isSuccess) {
      router.push('/signin')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen max-w-2xl space-y-4">
      <span>{userData?.email}</span>
      <ul>{!loading && data?.notes.map((note) => <li key={note.id}>{note.content}</li>)}</ul>
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  )
}
