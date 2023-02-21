import { NhostGraphqlClient } from '../../src'
import schema from '../schemas/hasura'
const client = new NhostGraphqlClient({ schema, url: '' })

// *****************************************************************
// ************************** Object *******************************
// *****************************************************************
const objects = async () => {
  // * Select all scalar fields
  const fullTodo = await client.query.todo({ variables: { id: 'abc' } })
  fullTodo.__typename
  fullTodo.category
  fullTodo.contents
  fullTodo.id
  fullTodo.createdAt
  fullTodo.updatedAt
  fullTodo.userId
  // * Do not allow unexisting fields
  // @ts-expect-error
  fullTodo.unexistingField
  // * Do not allow non-scalar fields
  // @ts-expect-error
  fullTodo.user

  // * Pick only some fields
  const restrictedTodo = await client.query.todo({
    variables: { id: 'abc' },
    select: { id: true, contents: true }
  })
  restrictedTodo.id
  restrictedTodo.contents
  // @ts-expect-error
  restrictedTodo.__typename
  // @ts-expect-error
  restrictedTodo.category
  // @ts-expect-error
  restrictedTodo.createdAt
  // @ts-expect-error
  restrictedTodo.updatedAt
  // @ts-expect-error
  restrictedTodo.userId

  // * Pick all the scalars of a relationship
  const fullUserTodo = await client.query.todo({
    variables: { id: 'abc' },
    select: { user: true }
  })
  fullUserTodo.user.__typename
  fullUserTodo.user.id
  fullUserTodo.user.email
  // @ts-expect-error
  fullUserTodo.user.unexistingField
  // @ts-expect-error
  fullUserTodo.id

  // * Pick only some fields of a relationship
  const restrictedUserTodo = await client.query.todo({
    variables: { id: 'abc' },
    select: { user: { select: { id: true } } }
  })
  restrictedUserTodo.user.id
  // @ts-expect-error
  restrictedUserTodo.user.email
  // @ts-expect-error
  fullUserTodo.user.unexistingField
  // @ts-expect-error
  fullUserTodo.id
}

// *****************************************************************
// ************************** Array ********************************
// *****************************************************************
const arrays = async () => {
  // * Select all scalar fields
  const fullTodos = await client.query.todos()
  // * Should not be an object
  // @ts-expect-error
  fullTodos.id
  const firstFullTodo = fullTodos[0]
  firstFullTodo.__typename
  firstFullTodo.category
  firstFullTodo.contents
  firstFullTodo.id
  firstFullTodo.createdAt
  firstFullTodo.updatedAt
  firstFullTodo.userId
  // * Do not allow unexisting fields
  // @ts-expect-error
  firstFullTodo.unexistingField
  // * Do not allow non-scalar fields
  // @ts-expect-error
  firstFullTodo.user

  // * Pick only some fields
  const restrictedTodos = await client.query.todos({
    select: { id: true, contents: true }
  })
  const firstRestrictedTodo = restrictedTodos[0]
  firstRestrictedTodo.id
  firstRestrictedTodo.contents
  // @ts-expect-error
  firstRestrictedTodo.__typename
  // @ts-expect-error
  firstRestrictedTodo.category
  // @ts-expect-error
  firstRestrictedTodo.createdAt
  // @ts-expect-error
  firstRestrictedTodo.updatedAt
  // @ts-expect-error
  firstRestrictedTodo.userId

  // * Pick all the scalars of a relationship
  const fullUserTodos = await client.query.todos({
    select: { user: true }
  })
  const firstUserTodo = fullUserTodos[0]
  firstUserTodo.user.__typename
  firstUserTodo.user.id
  firstUserTodo.user.email
  // @ts-expect-error
  firstUserTodo.user.unexistingField
  // @ts-expect-error
  firstUserTodo.id

  // * Pick only some fields of a relationship
  const restrictedUserTodos = await client.query.todos({
    select: { user: { select: { id: true } } }
  })
  const firstRestrictedUserTodo = restrictedUserTodos[0]
  firstRestrictedUserTodo.user.id
  // @ts-expect-error
  firstRestrictedUserTodo.user.email
  // @ts-expect-error
  firstRestrictedUserTodo.user.unexistingField
  // @ts-expect-error
  firstRestrictedUserTodo.id
}
