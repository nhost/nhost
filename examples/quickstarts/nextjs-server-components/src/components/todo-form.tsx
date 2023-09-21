'use client'

import { createTodo } from '@actions'
import Input from '@components/input'
import { useRef } from 'react'
import SubmitButton from './submit-button'

export default function TodoForm() {
  const formRef = useRef<HTMLFormElement>(null)

  const handleCreateTodo = async (formData: FormData) => {
    formRef.current?.reset()
    await createTodo(formData)
  }

  return (
    <form ref={formRef} action={handleCreateTodo} className="flex space-x-2">
      <Input
        id="title"
        name="title"
        required
        placeholder="What needs to be done"
        className="w-full"
      />
      <SubmitButton>Add</SubmitButton>
    </form>
  )
}
