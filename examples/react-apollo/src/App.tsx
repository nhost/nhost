import './App.css'

import { gql } from '@apollo/client'
import {
  useEmailPasswordlessSignIn,
  useAuthenticated,
  useAccessToken,
  useSignOut,
  useEmailPasswordSignIn,
  useEmailPasswordSignUp,
  useChangeEmail,
  useChangePassword
} from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'

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
  const jwt = useAccessToken()
  const { signOut } = useSignOut()
  const { signUp, ...signUpResult } = useEmailPasswordSignUp(email, password)
  const { signIn } = useEmailPasswordSignIn(email, password)
  const { signIn: passwordlessSignIn } = useEmailPasswordlessSignIn(email)
  const { changeEmail, ...changeEmailResult } = useChangeEmail('bidon@bidon.com')
  const { changePassword } = useChangePassword('12345678')
  const { loading, data, error } = useAuthQuery(GET_GREETING)
  return (
    <div className="App">
      <header className="App-header">
        <h1>React & Apollo</h1>
      </header>
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

        <p>JWT</p>
        <div>{jwt}</div>
        {isAuthenticated && (
          <ul>
            {data?.test.map((item) => (
              <li key={item.id}>{item.id}</li>
            ))}
          </ul>
        )}
        {!loading && error && <div>ok {JSON.stringify(error)}</div>}
      </div>
    </div>
  )
}

export default App
