import React from 'react'
import { useQuery } from 'urql'

import { graphql } from '../gql/gql'

const GET_PUBLIC_POSTS = graphql(`
  query GetPublicPosts {
    posts {
      id
      title
    }
  }
`)

export function ListPublicPosts() {
  const [{ data, fetching }] = useQuery({ query: GET_PUBLIC_POSTS })

  if (fetching) {
    return <div>Loading...</div>
  }

  if (!data) {
    return <div>No data</div>
  }

  const { posts } = data

  return (
    <div>
      <h1 className="text-3xl">Public Posts</h1>
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
