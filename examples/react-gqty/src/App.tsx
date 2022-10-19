import React, { Suspense } from 'react'

import { NhostReactProvider } from '@nhost/react'

import { SignedIn, SignedOut } from './components/controlls'
import { ListPrivatePosts } from './components/ListPrivatePosts'
import { ListPublicPosts } from './components/ListPublicPosts'
import { SignIn } from './components/SignIn'
import { nhost } from './utils/nhost'

import './App.css'

function App() {
  return (
    <div className="App">
      <NhostReactProvider nhost={nhost}>
        <SignedIn>
          <Suspense fallback="Loading...">
            <ListPrivatePosts />
          </Suspense>
          <div>
            <button onClick={() => nhost.auth.signOut()}>Sign Out</button>
          </div>
        </SignedIn>
        <SignedOut>
          <Suspense fallback="Loading...">
            <ListPublicPosts />
          </Suspense>
          <hr />
          <div>
            <SignIn />
          </div>
        </SignedOut>
      </NhostReactProvider>
    </div>
  )
}

export default App
