import React, { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'urql'

import { graphql } from '../gql/gql'

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

  const context = useMemo(() => ({ additionalTypenames: ['tasks'] }), [])
  const [{ data, fetching }] = useQuery({
    query: GET_TASKS,
    context
  })

  const [{ fetching: insertPostIsLoading }, insertTask] = useMutation(INSERT_TASK)
  const [_, deleteTask] = useMutation(DELETE_TASK)
  const [__, updateTask] = useMutation(UPDATE_TASK)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!name) {
      return
    }

    await insertTask({
      task: {
        name
      }
    })

    setName('')
  }

  if (fetching) {
    return <div>Loading...</div>
  }

  if (!data) {
    return <div>No data</div>
  }

  const { tasks } = data

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Todos</h1>
      <div>
        {tasks.map((task) => {
          return (
            <div
              key={task.id}
              className="flex justify-between hover:bg-gray-900 transition-all duration-300 ease-in-out"
            >
              <div className="p-2">{task.name}</div>
              <div
                className="p-2 cursor-pointer"
                onClick={() => {
                  updateTask({
                    id: task.id,
                    task: {
                      done: !task.done
                    }
                  })
                }}
              >
                {task.done ? 'yes' : 'no'}
              </div>
              <div
                onClick={() => {
                  deleteTask({ id: task.id })
                }}
                className="cursor-pointer p-2"
              >
                delete
              </div>
            </div>
          )
        })}
      </div>
      <div>
        <h2 className="text-lg">New Task</h2>
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-gray-100 block w-full rounded-sm shadow-sm focus:shadow-md sm:text-sm"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="rounded-sm border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full "
                disabled={insertPostIsLoading}
              >
                Add Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
