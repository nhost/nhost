import './App.css'

import { gql } from '@apollo/client'
import { useState } from 'react'
import {
  useEmailPasswordlessSignIn,
  useAuthenticated,
  useAccessToken,
  useSignOut,
  useEmailPasswordSignIn,
  useRefreshToken,
  useSignUpEmailPassword,
  useChangeEmail,
  useChangePassword
} from './react'
import { useAuthQuery } from './react-apollo'

const GET_GREETING = gql`
  query MyQuery {
    test {
      id
    }
  }
`
function App() {
  const isAuthenticated = useAuthenticated()
  const email = 'pilou@pilou.com'
  const password = 'piloupilou'
  const [token, setToken] = useState('')
  const changeToken = (event: React.ChangeEvent<HTMLInputElement>) => setToken(event.target.value)
  const jwt = useAccessToken()
  const { signOut } = useSignOut()
  const { signUp, ...signUpResult } = useSignUpEmailPassword(email, password)
  const { signIn } = useEmailPasswordSignIn(email, password)
  const { signIn: passwordlessSignIn } = useEmailPasswordlessSignIn(email)
  const [, updateToken] = useRefreshToken()
  const { change: changeEmail, ...changeEmailResult } = useChangeEmail('bidon@bidon.com')
  const { change: changePassword } = useChangePassword('12345678')
  const { loading, data } = useAuthQuery(GET_GREETING)

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

        <input type="text" value={token} onChange={changeToken} />
        <button onClick={() => updateToken(token)}>Set refresh token</button>

        <p>JWT</p>
        <div>{jwt}</div>
        {!loading && <div>ok {JSON.stringify(data)}</div>}
      </header>
    </div>
  )
}

export default App
