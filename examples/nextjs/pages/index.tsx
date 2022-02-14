import type { NextPage } from 'next'
import {
  useEmailPasswordlessSignIn,
  useAuthenticated,
  useAccessToken,
  useSignOut,
  useEmailPasswordSignIn,
  useSignUpEmailPassword,
  useChangeEmail,
  useChangePassword
} from '@nhost/react'
import { withNhost } from '../helpers'

// * Reference: https://blog.codepen.io/2021/09/01/331-next-js-apollo-server-side-rendering-ssr/

const Home: NextPage = () => {
  const isAuthenticated = useAuthenticated()
  const email = 'pilou@pilou.com'
  const password = 'piloupilou'
  const jwt = useAccessToken()
  const { signOut } = useSignOut()
  const { signUp, ...signUpResult } = useSignUpEmailPassword(email, password)
  const { signIn } = useEmailPasswordSignIn(email, password)
  const { signIn: passwordlessSignIn } = useEmailPasswordlessSignIn(email)
  const { change: changeEmail, ...changeEmailResult } = useChangeEmail('bidon@bidon.com')
  const { change: changePassword } = useChangePassword('12345678')

  return (
    <div className="App">
      <header className="App-header">
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

        <p>JWT</p>
        <div>{jwt}</div>
      </header>
    </div>
  )
}

export default withNhost(Home)
