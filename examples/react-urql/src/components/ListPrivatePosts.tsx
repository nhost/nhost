import React, { useState } from 'react'
import { useMutation, useQuery } from 'urql'

import { useUserData } from '@nhost/react'

import { graphql } from '../gql/gql'

const GET_PRIVATE_POSTS = graphql(`
  query GetPrivatePosts($userId: uuid!) {
    posts(where: { user_id: { _eq: $userId } }) {
      id
      title
    }
  }
`)

const INSERT_POST = graphql(`
  mutation InsertPost($post: posts_insert_input!) {
    insertPosts(objects: [$post]) {
      affected_rows
      returning {
        id
        title
      }
    }
  }
`)

const DELETE_POST = graphql(`
  mutation DeletePost($id: uuid!) {
    deletePost(id: $id) {
      id
    }
  }
`)

export function ListPrivatePosts() {
  const [title, setTitle] = useState('')
  const user = useUserData()!
  const [{ data, fetching }] = useQuery({
    query: GET_PRIVATE_POSTS,
    variables: {
      userId: user.id
    }
  })

  const [{ fetching: insertPostIsLoading }, insertPost] = useMutation(INSERT_POST)
  const [_, deletePost] = useMutation(DELETE_POST)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!title) {
      return
    }

    await insertPost({
      post: {
        title
      }
    })

    setTitle('')
  }

  if (fetching) {
    return <div>Loading...</div>
  }

  if (!data) {
    return <div>No data</div>
  }

  const { posts } = data

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Private Posts</h1>
      <div>
        {posts.map((post) => {
          return (
            <div key={post.id ?? 0} className="flex justify-between hover:bg-slate-100">
              <div>{post.title}</div>
              <div
                onClick={() => {
                  deletePost({ id: post.id })
                }}
                className="cursor-pointer"
              >
                delete
              </div>
            </div>
          )
        })}
      </div>
      <div>
        <h2 className="text-2xl">New post</h2>
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                disabled={insertPostIsLoading}
              >
                Add Post
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
