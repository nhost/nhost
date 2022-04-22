import type { NextPage } from 'next'
import { useState } from 'react'

import {
  useAccessToken,
  useAuthenticated,
  useChangeEmail,
  useChangePassword,
  useSignInEmailPassword,
  useSignInEmailPasswordless,
  useSignOut,
  useSignUpEmailPassword
} from '@nhost/nextjs'
import { useAuthQuery } from '@nhost/react-apollo'

import { BOOKS_QUERY } from '../helpers'

// * Reference: https://blog.codepen.io/2021/09/01/331-next-js-apollo-server-side-rendering-ssr/

const Home: NextPage = () => {
  const isAuthenticated = useAuthenticated()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const accessToken = useAccessToken()
  const { signOut } = useSignOut()
  const { signUpEmailPassword, ...signUpResult } = useSignUpEmailPassword()
  const { signInEmailPassword } = useSignInEmailPassword()
  const { signInEmailPasswordless } = useSignInEmailPasswordless()
  const { changeEmail, ...changeEmailResult } = useChangeEmail()
  const { changePassword, ...changePasswordResult } = useChangePassword()
  const { loading, data, error } = useAuthQuery(BOOKS_QUERY)
  return (
    <div>
      {isAuthenticated ? (
        <>
          <button onClick={signOut}>Logout</button>
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <button onClick={() => changeEmail(email)}>Change email</button>
          <div>{JSON.stringify(changeEmailResult)}</div>
          <button onClick={() => changePassword(password)}>Change password</button>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <div>{JSON.stringify(changePasswordResult)}</div>
        </>
      ) : (
        <>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={() => signInEmailPasswordless(email)}>Passwordless signin</button>
          <div>{JSON.stringify(signUpResult)}</div>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          <button onClick={() => signUpEmailPassword(email, password)}>
            Email + password sign-up
          </button>
          <button onClick={() => signInEmailPassword(email, password)}>
            Email + password sign-in
          </button>
        </>
      )}

      <p>Access Token</p>
      <div>{accessToken}</div>
      {isAuthenticated && (
        <ul>
          {data?.books.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
      )}
      {!loading && error && <div>ok {JSON.stringify(error)}</div>}
    </div>
  )
}

export default Home
