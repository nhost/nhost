import type { NextPage } from 'next'

import {
  useAccessToken,
  useAuthenticated,
  useChangeEmail,
  useChangePassword,
  useEmailPasswordlessSignIn,
  useEmailPasswordSignIn,
  useEmailPasswordSignUp,
  useSignOut
} from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'

import { QUERY_INDEX } from '../helpers'

// * Reference: https://blog.codepen.io/2021/09/01/331-next-js-apollo-server-side-rendering-ssr/

const Home: NextPage = () => {
  const isAuthenticated = useAuthenticated()
  const email = 'pilou@pilou.com'
  const password = 'piloupilou'
  const accessToken = useAccessToken()
  const { signOut } = useSignOut()
  const { signUp, ...signUpResult } = useEmailPasswordSignUp(email, password)
  const { signIn } = useEmailPasswordSignIn(email, password)
  const { signIn: passwordlessSignIn } = useEmailPasswordlessSignIn(email)
  const { changeEmail, ...changeEmailResult } = useChangeEmail('bidon@bidon.com')
  const { changePassword } = useChangePassword('12345678')
  const { loading, data, error } = useAuthQuery(QUERY_INDEX)
  return (
    <div>
      {isAuthenticated ? (
        <>
          <button onClick={signOut}>Logout</button>
          <button onClick={changeEmail}>Change email</button>
          <div>{JSON.stringify(changeEmailResult)}</div>
          <button onClick={changePassword}>Change password</button>
        </>
      ) : (
        <>
          <button onClick={signUp}>Register</button>
          <div>{JSON.stringify(signUpResult)}</div>
          <button onClick={signIn}>Email + password signin</button>
          <button onClick={passwordlessSignIn}>Passwordless signin</button>
        </>
      )}

      <p>Access Token</p>
      <div>{accessToken}</div>
      {isAuthenticated && (
        <ul>
          {data?.test.map((item) => (
            <li key={item.id}>{item.id}</li>
          ))}
        </ul>
      )}
      {!loading && error && <div>ok {JSON.stringify(error)}</div>}
    </div>
  )
}

export default Home
