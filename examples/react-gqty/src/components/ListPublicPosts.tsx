import React from 'react'

import { useQuery } from '../gqty'

export function ListPublicPosts() {
  const query = useQuery({
    suspense: true
  })

  return (
    <div>
      <h1 className="text-3xl">Public Posts</h1>
      <div>
        {query.posts().map((post) => {
          return <div key={post.id ?? 0}>{post.title}</div>
        })}
      </div>
    </div>
  )
}
