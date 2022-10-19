import React from 'react'

import { useQuery } from '../gqty'
import { nhost } from '../utils/nhost'

export function ListPrivatePosts() {
  const query = useQuery({
    suspense: true
  })

  const user = nhost.auth.getUser()

  return (
    <div>
      <h1>Private Posts</h1>
      <div>
        {query.posts({ where: { user_id: { _eq: user?.id } } }).map((post) => {
          return <div key={post.id ?? 0}>{post.title}</div>
        })}
      </div>
    </div>
  )
}
