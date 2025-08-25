import React from 'react'

import { NhostProvider, SignedIn, SignedOut } from '@nhost/react'

import { Tasks } from './components/Tasks'
import { SignIn } from './components/SignIn'
import { nhost } from './utils/nhost'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/react-query-client'

import './index.css'

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <QueryClientProvider client={queryClient}>
        <SignedIn>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 mt-6 text-gray-200">
            <div className="flex justify-between  pb-4 mb-4 border-b border-gray-700">
              <div className="uppercase font-semibold">Todo App</div>
              <div>
                <button
                  onClick={() => nhost.auth.signOut()}
                  type="submit"
                  className="rounded-sm border border-transparent px-3 py-2 text-sm font-medium leading-4 bg-slate-100 hover:bg-slate-200 text-gray-800 shadow-sm hover:focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full "
                >
                  Sign Out
                </button>
              </div>
            </div>
            <Tasks />
          </div>
        </SignedIn>
        <SignedOut>
          <div className="h-full">
            <SignIn />
          </div>
        </SignedOut>
      </QueryClientProvider>
    </NhostProvider>
  )
}

export default App
