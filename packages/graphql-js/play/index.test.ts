import { expect, it } from 'vitest'
import { NhostGraphqlClient } from '../src'
import schema from '../tests/schemas/hasura'

const client = new NhostGraphqlClient({
  schema,
  url: 'http://localhost:1337/v1/graphql'
})

it('should be used to play a bit with the client', async () => {
  const email = 'bob@bob.com'
  let [user] = await client.query.users({
    select: { email: true, id: true, defaultRole: true },
    variables: { where: { email: { _eq: email } } }
  })

  if (!user) {
    user = await client.mutation.insertUser({
      variables: { object: { locale: 'en', email } },
      select: { email: true, id: true, defaultRole: true }
    })
  }

  expect(user).toMatchInlineSnapshot(`
    {
      "defaultRole": "user",
      "email": "bob@bob.com",
      "id": "e8a41817-e3b1-4d4e-8360-e0b9e5e203bd",
    }
  `)

  const todos = await client.query.todos({ select: { user: true, contents: true } })
  console.log(`${todos.length} todos`)

  const newTodo = await client.mutation.insertTodo({
    variables: { object: { contents: 'encore', userId: user.id } },
    select: { contents: true, category: true }
  })

  expect(newTodo).toMatchInlineSnapshot(`
    {
      "category": null,
      "contents": "encore",
    }
  `)
})
