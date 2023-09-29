'use client'

import Input from '@components/input'
import { createTodo } from '@server-actions/todos'
import SubmitButton from './submit-button'

export default function TodoForm() {
  return (
    <form action={createTodo} className="flex flex-col space-y-2">
      <Input
        id="title"
        name="title"
        required
        placeholder="What needs to be done"
        className="w-full"
      />

      <Input id="file" name="file" type="file" className="w-full" accept="image/*" />

      <SubmitButton>Add</SubmitButton>
    </form>
  )
}
