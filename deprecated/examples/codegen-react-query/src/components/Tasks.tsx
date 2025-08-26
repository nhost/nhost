import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import React, { useState } from 'react'

import { graphql } from '../gql/gql'
import { Tasks_Set_Input } from '../gql/graphql'
import { gqlClient } from '../utils/graphql-client'
import { queryClient } from '../utils/react-query-client'

const GET_TASKS = graphql(`
  query GetTasks {
    tasks(order_by: { createdAt: desc }) {
      id
      name
      done
    }
  }
`)

const INSERT_TASK = graphql(`
  mutation InsertTask($task: tasks_insert_input!) {
    insertTasks(objects: [$task]) {
      affected_rows
      returning {
        id
        name
      }
    }
  }
`)

const UPDATE_TASK = graphql(`
  mutation UpdateTask($id: uuid!, $task: tasks_set_input!) {
    updateTask(pk_columns: { id: $id }, _set: $task) {
      id
      name
      done
    }
  }
`)

const DELETE_TASK = graphql(`
  mutation DeleteTask($id: uuid!) {
    deleteTask(id: $id) {
      id
    }
  }
`)

export function Tasks() {
  const [name, setName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      return gqlClient.request(GET_TASKS)
    }
  })

  const insertTask = useMutation({
    mutationFn: (name: string) => {
      return gqlClient.request(INSERT_TASK, {
        task: {
          name
        }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks'])
    }
  })

  const deleteTask = useMutation({
    mutationFn: (id: string) => {
      return gqlClient.request(DELETE_TASK, {
        id
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks'])
    }
  })

  const updateTask = useMutation({
    mutationFn: ({ id, task }: { id: string; task: Tasks_Set_Input }) => {
      return gqlClient.request(UPDATE_TASK, {
        id,
        task
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks'])
    }
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!name) {
      return
    }

    await insertTask.mutate(name)

    setName('')
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!data) {
    return <div>No data</div>
  }

  const { tasks } = data

  return (
    <div className="space-y-5">
      <div>
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Todo
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  placeholder="Todo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-gray-100 block w-full rounded-sm shadow-sm focus:shadow-md sm:text-sm"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="rounded-sm border border-transparent px-3 py-2 text-sm font-medium leading-4 bg-slate-100 hover:bg-slate-200 text-gray-800 shadow-sm hover:focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full "
                disabled={insertTask.isLoading}
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </div>
      <div>
        {tasks.map((task) => {
          const style = clsx('p-2', {
            'line-through text-green-600': task.done
          })

          return (
            <div
              key={task.id}
              className="flex justify-between transition-all duration-300 ease-in-out"
            >
              <div className={style}>{task.name}</div>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    updateTask.mutate({
                      id: task.id,
                      task: {
                        done: !task.done
                      }
                    })
                  }}
                  className="cursor-pointer p-2 hover:bg-gray-900 rounded-sm transition-all duration-100 ease-in-out"
                >
                  {task.done ? 'Not Done' : 'Done'}
                </button>
                <button
                  onClick={() => {
                    deleteTask.mutate(task.id)
                  }}
                  className="cursor-pointer p-2 hover:bg-gray-900 rounded-sm transition-all duration-100 ease-in-out"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
