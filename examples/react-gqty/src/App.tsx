import { NhostProvider } from '@nhost/react'
import React, { Suspense } from 'react'
import { SignedIn, SignedOut } from './components/controlls'
import { ListPrivatePosts } from './components/ListPrivatePosts'
import { ListPublicPosts } from './components/ListPublicPosts'
import { SignIn } from './components/SignIn'
import { nhost } from './utils/nhost'

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="mx-auto max-w-3xl">
          <SignedIn>
            <Suspense fallback="Loading...">
              <ListPrivatePosts />
            </Suspense>
            <div className="pt-6 mt-6 border-t-2">
              <button
                onClick={() => nhost.auth.signOut()}
                type="submit"
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Sign Out
              </button>
            </div>
          </SignedIn>
          <SignedOut>
            <div className="space-y-5">
              <Suspense fallback="Loading...">
                <ListPublicPosts />
              </Suspense>
              <hr />
              <SignIn />
            </div>
          </SignedOut>
        </div>
      </div>
    </NhostProvider>
  )
}

export default App
