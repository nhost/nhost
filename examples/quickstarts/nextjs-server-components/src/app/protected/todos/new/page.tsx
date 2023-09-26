import TodoForm from '@components/todo-form'

export default function NewTodo() {
  return (
    <div className="flex flex-col max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl">New Todo</h2>
      <TodoForm />
    </div>
  )
}
