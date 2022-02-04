import './App.css'

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

function App() {
  const isAuthenticated = useAuthenticated()
  const isLoading = useLoading()

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
  const user = useUserData()
  useEffect(() => {
    console.log(isLoading, isAuthenticated, user)
  }, [isLoading, isAuthenticated, user])

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

        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  )
}

export default App
