import './App.css'

import { gql, useQuery } from '@apollo/client'
import { useState, useEffect } from 'react'
import {
  useEmailPasswordlessSignIn,
  useLoading,
  useAuthenticated,
  useAccessToken,
  useSignOut,
  useEmailPasswordSignIn,
  useRefreshToken,
  useSignUpEmailPassword,
  useUserData
} from './react-auth'

const GET_GREETING = gql`
  query GetGreeting($language: String!) {
    greeting(language: $language) {
      message
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
  const signOut = useSignOut()
  const signUp = useSignUpEmailPassword(email, password)
  const signIn = useEmailPasswordSignIn(email, password)
  const passwordlessSignIn = useEmailPasswordlessSignIn(email)
  const [, updateToken] = useRefreshToken()

  const { loading, error, data } = useQuery(GET_GREETING, {
    variables: { language: 'english' }
  })
  // if (loading) return <p>Loading ...</p>;

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={signUp}>Register</button>
        {!isAuthenticated && <button onClick={signIn}>Email + password signin</button>}
        {!isAuthenticated && <button onClick={passwordlessSignIn}>Passwordless signin</button>}
        {isAuthenticated && <button onClick={signOut}>Logout</button>}

        <input type="text" value={token} onChange={changeToken} />
        <button onClick={() => updateToken(token)}>Set refresh token</button>

        <p>JWT</p>
        <div>{jwt}</div>
        {loading ? <div>loading</div> : <div>ok</div>}
      </header>
    </div>
  )
}

export default App
