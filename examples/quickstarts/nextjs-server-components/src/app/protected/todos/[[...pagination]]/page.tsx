import { gql } from '@apollo/client'
import TodoForm from '@components/todo-form'
import TodoItem, { type Todo } from '@components/todo-item'

import { getNhost } from '@utils/nhost'
import Head from 'next/head'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Todos({
  params
}: {
  params: { [key: string]: string | string[] | undefined }
}) {
  const page = parseInt(params.pagination?.at(0) || '0')

  const nhost = await getNhost()

  const {
    data: {
      todos,
      todos_aggregate: {
        aggregate: { count }
      }
    }
  } = await nhost.graphql.request(
    gql`
      query getTodos($limit: Int, $offset: Int) {
        todos(limit: $limit, offset: $offset, order_by: { createdAt: desc }) {
          id
          title
          done
        }

        todos_aggregate {
          aggregate {
            count
          }
        }
      }
    `,
    {
      offset: page * 10,
      limit: 10
    }
  )

  return (
    <div className="space-y-4">
      <Head>
        <title>Protected Page</title>
      </Head>

      <div className="w-full space-y-2">
        <p className="text-xl">Todos ({count})</p>

        <TodoForm />
      </div>

      <ul className="space-y-1">
        {todos.map((todo: Todo) => (
          <li key={todo.id}>
            <TodoItem todo={todo} />
          </li>
        ))}
      </ul>

      {count > 10 && (
        <div className="flex justify-center space-x-2">
          {page > 0 && (
            <Link
              href={`/protected/todos/${page - 1}`}
              className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Previous
            </Link>
          )}

          {page + 1 < Math.ceil(count / 10) && (
            <Link
              href={`/protected/todos/${page + 1}`}
              className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
