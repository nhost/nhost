import React, { Suspense } from 'react'

import { useQuery } from './gqty'

import './App.css'

function Example() {
  const query = useQuery({
    suspense: true
  })

  return (
    <div>
      <h1>Posts</h1>
      <div>
        {query.posts().map((post) => {
          return <div key={post.id}>{post.title}</div>
        })}
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="App">
      <Suspense fallback="Loading...">
        <Example />
      </Suspense>
    </div>
  )
}

export default App
