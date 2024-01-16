import TodoForm from '@components/todo-form'
import withAuthAsync from '@utils/auth-guard'

const NewTodo = async () => {
  return (
    <div className="flex flex-col max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl">New Todo</h2>
      <TodoForm />
    </div>
  )
}

export default withAuthAsync(NewTodo)
