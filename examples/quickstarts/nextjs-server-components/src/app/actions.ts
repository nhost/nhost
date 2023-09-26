'use server'

import { gql } from '@apollo/client'
import { NHOST_SESSION_KEY, getNhost } from '@utils/nhost'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const signUp = async (formData: FormData) => {
  const nhost = await getNhost()

  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { session, error } = await nhost.auth.signUp({
    email,
    password,
    options: {
      displayName: `${firstName} ${lastName}`
    }
  })

  if (session) {
    cookies().set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), { path: '/' })
    redirect('/protected/todos')
  }

  if (error) {
    return {
      error: error?.message
    }
  }
}

export const signIn = async (formData: FormData) => {
  const nhost = await getNhost()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { session, error } = await nhost.auth.signIn({ email, password })

  if (session) {
    cookies().set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), { path: '/' })
    redirect('/protected/todos')
  }

  if (error) {
    return {
      error: error?.message
    }
  }
}

export const signInWithPAT = async (formData: FormData) => {
  const nhost = await getNhost()

  const pat = formData.get('pat') as string

  const { session, error } = await nhost.auth.signInPAT(pat)

  if (session) {
    cookies().set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), { path: '/' })
    redirect('/protected/todos')
  }

  if (error) {
    return {
      error: error?.message
    }
  }
}

export const signInWithGoogle = async () => {
  const nhost = await getNhost()

  const { providerUrl } = await nhost.auth.signIn({
    provider: 'google',
    options: {
      redirectTo: `/oauth`
    }
  })

  if (providerUrl) {
    redirect(providerUrl)
  }
}

export const signInWithApple = async () => {
  const nhost = await getNhost()

  const { providerUrl } = await nhost.auth.signIn({
    provider: 'apple',
    options: {
      redirectTo: `/oauth`
    }
  })

  if (providerUrl) {
    redirect(providerUrl)
  }
}

export const signInWithSecurityKey = async (formData: FormData) => {
  const nhost = await getNhost()

  const email = formData.get('email') as string

  const { error, session } = await nhost.auth.signIn({
    email: email,
    securityKey: true
  })

  if (!session) {
    // Something unexpected happened
    return {
      error: error?.message
    }
  }

  // Something unexpected happened, for instance, the user canceled the process
  if (error) {
    return {
      error: error?.message
    }
  }
}

export const signOut = async () => {
  const nhost = await getNhost()

  await nhost.auth.signOut()

  cookies().delete(NHOST_SESSION_KEY)

  redirect('/auth/sign-in')
}

export const createTodo = async (formData: FormData) => {
  const nhost = await getNhost()

  const title = formData.get('title') as string
  const file = formData.get('file') as File

  let payload: {
    title: string
    file_id?: string
  } = {
    title
  }

  if (file) {
    const { error, fileMetadata } = await nhost.storage.upload({
      formData
    })

    payload.file_id = fileMetadata?.processedFiles[0]?.id
  }

  const { error } = await nhost.graphql.request(
    gql`
      mutation insertTodo($title: String!, $file_id: uuid) {
        insert_todos_one(object: { title: $title, file_id: $file_id }) {
          id
        }
      }
    `,
    payload
  )

  if (error) {
    // TODO firgure out where to redirect when there's an error coming from the graphql api
  }

  redirect('/protected/todos')
}

export const updateTodo = async (id: string, done: boolean) => {
  const nhost = await getNhost()

  await nhost.graphql.request(
    gql`
      mutation updateTodo($id: uuid!, $done: Boolean!) {
        update_todos_by_pk(pk_columns: { id: $id }, _set: { done: $done }) {
          id
          title
          done
        }
      }
    `,
    {
      id,
      done
    }
  )

  revalidatePath('/protected/todos')
}

export const deleteTodo = async (id: string) => {
  const nhost = await getNhost()

  await nhost.graphql.request(
    gql`
      mutation deleteTodo($id: uuid!) {
        delete_todos_by_pk(id: $id) {
          id
        }
      }
    `,
    {
      id
    }
  )

  revalidatePath('/protected/todos')
}
