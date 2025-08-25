import React, { useState } from 'react'

import { useMutation, useQuery } from '../gqty'
import { nhost } from '../utils/nhost'

export function ListPrivatePosts() {
  const user = nhost.auth.getUser()

  const [title, setTitle] = useState('')

  const query = useQuery({
    suspense: true
  })

  const [createPost, { isLoading }] = useMutation(
    (mutatation, post: { title: string }) => {
      console.log('1')

      const ret = mutatation.insertPost({ object: post })

      if (ret) {
        return ret.id
      }
    },
    {
      refetchQueries: [query.posts({ where: { user_id: { _eq: user?.id } } })]
    }
  )

  const [deletePost] = useMutation(
    (mutation, id: string) => {
      const ret = mutation.deletePost({ id })

      if (ret) {
        return ret.id
      }
    },
    {
      refetchQueries: [query.posts({ where: { user_id: { _eq: user?.id } } })]
    }
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!title) {
      return
    }

    createPost({
      args: {
        title
      }
    })

    setTitle('')
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Private Posts</h1>
      <div>
        {query.posts({ where: { user_id: { _eq: user?.id } } }).map((post) => {
          return (
            <div key={post.id ?? 0} className="flex justify-between hover:bg-slate-100">
              <div>{post.title}</div>
              <div
                onClick={() => {
                  deletePost({ args: post.id })
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
                disabled={isLoading}
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
