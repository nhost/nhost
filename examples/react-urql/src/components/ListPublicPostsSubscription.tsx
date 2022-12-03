import React from 'react'
import { useSubscription } from 'urql'

import { graphql } from '../gql/gql'

const GET_PUBLIC_POSTS_SUB = graphql(`
  subscription GetPublicPostsSub {
    posts {
      id
      title
    }
  }
`)

export function ListPublicPostsSubscription() {
  const [{ data, fetching }] = useSubscription({ query: GET_PUBLIC_POSTS_SUB })

  if (fetching) {
    return <div>Loading...</div>
  }

  if (!data) {
    return <div>No data</div>
  }

  const { posts } = data

  return (
    <div className="my-6">
      <h1 className="text-3xl">Private Posts (using subscription)</h1>
      <div>
        {posts.map((post) => {
          return (
            <div key={post.id}>
              <h2>{post.title}</h2>
            </div>
          )
        })}
      </div>
    </div>
  )
}
