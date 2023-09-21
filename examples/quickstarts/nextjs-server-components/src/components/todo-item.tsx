'use client'

import { deleteTodo, updateTodo } from '@actions'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface Todo {
  id: string
  title: string
  done: boolean
}

const TodoItem = ({ todo }: { todo: Todo }) => {
  const [completed, setCompleted] = useState(todo.done)

  const handleCheckboxChange = async () => {
    setCompleted(!completed)

    // This a server action
    await updateTodo(todo.id, !completed)
  }

  const handleDeleteTodo = async () => {
    console.log('delete')
    await deleteTodo(todo.id)
  }

  return (
    <div
      className={twMerge(
        'group flex flex-row items-center p-2 bg-slate-100',
        completed && 'line-through bg-slate-200'
      )}
    >
      <label
        htmlFor={todo.id}
        className={twMerge(
          'block w-full space-x-2 rounded  select-none justify-center',
          completed && 'line-through bg-slate-200'
        )}
      >
        <input type="checkbox" id={todo.id} checked={completed} onChange={handleCheckboxChange} />
        <span>{todo.title}</span>
      </label>

      <button onClick={handleDeleteTodo} className="hidden w-5 h-5 text-red-500 group-hover:flex">
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 30 30">
          <path
            fill="currentColor"
            d="M 13 3 A 1.0001 1.0001 0 0 0 11.986328 4 L 6 4 A 1.0001 1.0001 0 1 0 6 6 L 24 6 A 1.0001 1.0001 0 1 0 24 4 L 18.013672 4 A 1.0001 1.0001 0 0 0 17 3 L 13 3 z M 6 8 L 6 24 C 6 25.105 6.895 26 8 26 L 22 26 C 23.105 26 24 25.105 24 24 L 24 8 L 6 8 z"
          />
        </svg>
      </button>
    </div>
  )
}

export default TodoItem
