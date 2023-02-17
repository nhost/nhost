import fetch from 'cross-fetch'
import { beforeAll, describe, expect, it } from 'vitest'
import { NhostGraphqlClient } from '../../src'
import schema from '../schemas/hasura'

const client = new NhostGraphqlClient({
  schema,
  url: 'http://localhost:1337/v1/graphql'
})

describe('Hasura', () => {
  let userId: string
  beforeAll(async () => {
    // * Reload the metadata, as Hasura fails to load the remote schema in functions,
    // * As functions are not available yet when Hasura starts and loads its metadata.
    await fetch('http://localhost:1337/v1/metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': 'nhost-admin-secret'
      },
      body: JSON.stringify({
        type: 'reload_metadata',
        args: {
          reload_remote_schemas: true,
          reload_sources: false,
          recreate_event_triggers: true
        }
      })
    })

    const { data } = await client.request(`mutation { insertUser(object: {locale: "en"} ) { id } }`)
    userId = data.insertUser.id
  })

  it('should insert a todo', async () => {
    const result = await client.mutation.insertTodo({
      variables: { object: { contents: 'test', userId } },
      select: {
        contents: true,
        user: { select: { email: true, id: true } }
      }
    })

    expect(result.contents).toMatchInlineSnapshot('"test"')
    expect(result.user.id).toEqual(userId)
  })

  it('should insert and remove a todo', async () => {
    const insertResult = await client.mutation.insertTodo({
      variables: { object: { contents: 'test', userId } },
      select: {
        id: true,
        contents: true
      }
    })

    expect(insertResult.contents).toMatchInlineSnapshot('"test"')
    const deleteResult = await client.mutation.deleteTodo({
      variables: { id: insertResult.id },
      select: { contents: true }
    })

    expect(deleteResult).toMatchInlineSnapshot(`
      {
        "contents": "test",
      }
    `)
  })

  it('should work with an enum', async () => {
    const todos = await client.query.todos({
      variables: {
        where: {
          category: { _eq: 'essay' }
        }
      },
      select: { contents: true, category: true }
    })

    expect(todos).toMatchInlineSnapshot('[]')
  })

  it('should work with a wildcard', async () => {
    const todos = await client.query.todos()

    expect(Object.keys(todos[0])).toMatchInlineSnapshot(`
      [
        "category",
        "contents",
        "createdAt",
        "id",
        "updatedAt",
        "userId",
      ]
    `)
  })

  it('should ignore an invalid property', async () => {
    const todos = await client.query.todos({
      select: { id: true, unexistingProperty: true }
    })

    expect(Object.keys(todos[0])).toMatchInlineSnapshot(`
      [
        "id",
      ]
    `)
  })

  it('should work with a nested wildcard', async () => {
    const todos = await client.query.todos({
      select: { id: true, user: true }
    })

    expect(Object.keys(todos[0])).toMatchInlineSnapshot(`
      [
        "id",
        "user",
      ]
    `)
    expect(Object.keys(todos[0].user)).toMatchInlineSnapshot(`
      [
        "avatarUrl",
        "createdAt",
        "defaultRole",
        "displayName",
        "email",
        "id",
        "isAnonymous",
        "lastSeen",
        "locale",
        "updatedAt",
      ]
    `)
  })

  it('should work with unions', async () => {
    const result = await client.query.everyone({
      on: {
        Human: { select: { pets: { select: { diet: true } } } },
        Dog: {
          select: {
            name: true,
            barks: true,
            owner: {
              select: {
                pets: { on: { Hamster: { select: { squeaks: true } } }, select: { name: true } }
              }
            }
          }
        },
        Hamster: { select: { name: true, diet: true } }
      }
    })

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "__typename": "Human",
          "pets": [
            {
              "diet": "CARNIVOROUS",
            },
            {
              "diet": "CARNIVOROUS",
            },
            {
              "diet": "HERBIVOROUS",
            },
          ],
        },
        {
          "__typename": "Dog",
          "barks": false,
          "name": "Fido",
          "owner": {
            "pets": [
              {
                "__typename": "Dog",
                "name": "Fido",
              },
              {
                "__typename": "Dog",
                "name": "Rover",
              },
              {
                "__typename": "Hamster",
                "name": "Hammy",
                "squeaks": true,
              },
            ],
          },
        },
        {
          "__typename": "Dog",
          "barks": true,
          "name": "Rover",
          "owner": {
            "pets": [
              {
                "__typename": "Dog",
                "name": "Fido",
              },
              {
                "__typename": "Dog",
                "name": "Rover",
              },
              {
                "__typename": "Hamster",
                "name": "Hammy",
                "squeaks": true,
              },
            ],
          },
        },
        {
          "__typename": "Hamster",
          "diet": "HERBIVOROUS",
          "name": "Hammy",
        },
      ]
    `)
  })

  it('should work with interfaces', async () => {
    const result = await client.query.pets({
      select: { name: true, owner: { select: { firstName: true } } },
      on: { Dog: { select: { barks: true } }, Hamster: true }
    })

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "__typename": "Dog",
          "barks": false,
          "name": "Fido",
          "owner": {
            "firstName": "John",
          },
        },
        {
          "__typename": "Dog",
          "barks": true,
          "name": "Rover",
          "owner": {
            "firstName": "John",
          },
        },
        {
          "__typename": "Hamster",
          "diet": "HERBIVOROUS",
          "name": "Hammy",
          "owner": {
            "firstName": "John",
          },
          "squeaks": true,
        },
      ]
    `)
  })
})
