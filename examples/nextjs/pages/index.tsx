import { NetworkStatus, useQuery } from '@apollo/client'
import { getDataFromTree } from '@apollo/client/react/ssr'
import type { GetServerSideProps, NextPage } from 'next'
import { useEffect, useState } from 'react'
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
// import { nhost } from './_app'

export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
  console.log('-----> getserverprops')
  // res.removeHeader('authorization')

  return {
    props: {}
  }
}

// * Reference: https://blog.codepen.io/2021/09/01/331-next-js-apollo-server-side-rendering-ssr/

// export const getServerSideProps: GetServerSideProps = async ({ req, res, locale }) => {
//   console.log('server side index', req.cookies)

//   // const interpreter = interpret(nhost.machine)
//   // const client = createApolloClient({ interpreter, backendUrl: nhost.backendUrl })
//   // Will be passed to the page component as props

//   return {
//     props: {}
//   }
// }
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

export default Home
