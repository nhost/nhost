import { describe, expect, it } from 'vitest'
import { NhostGraphqlClient } from '../../src'
import schema from '../schemas/swapi'

const client = new NhostGraphqlClient({
  schema,
  url: 'https://swapi-graphql.netlify.app/.netlify/functions/index'
})

describe('Swapi', () => {
  it('should get a single file', async () => {
    const result = await client.query.film({
      variables: { id: 'ZmlsbXM6MQ==' },
      select: { title: true }
    })

    expect(result).toMatchInlineSnapshot(`
      {
        "title": "A New Hope",
      }
    `)
  })

  it('should fetch several files', async () => {
    const result = await client.query.allFilms({
      variables: { before: 'ZmlsbXM6MQ==' },
      select: {
        edges: {
          select: {
            node: {
              select: {
                characterConnection: {
                  select: { totalCount: true }
                },
                director: true,
                title: true
              }
            }
          }
        }
      }
    })

    expect(result).toMatchInlineSnapshot(`
      {
        "edges": [
          {
            "node": {
              "characterConnection": {
                "totalCount": 18,
              },
              "director": "George Lucas",
              "title": "A New Hope",
            },
          },
          {
            "node": {
              "characterConnection": {
                "totalCount": 16,
              },
              "director": "Irvin Kershner",
              "title": "The Empire Strikes Back",
            },
          },
          {
            "node": {
              "characterConnection": {
                "totalCount": 20,
              },
              "director": "Richard Marquand",
              "title": "Return of the Jedi",
            },
          },
          {
            "node": {
              "characterConnection": {
                "totalCount": 34,
              },
              "director": "George Lucas",
              "title": "The Phantom Menace",
            },
          },
          {
            "node": {
              "characterConnection": {
                "totalCount": 40,
              },
              "director": "George Lucas",
              "title": "Attack of the Clones",
            },
          },
          {
            "node": {
              "characterConnection": {
                "totalCount": 34,
              },
              "director": "George Lucas",
              "title": "Revenge of the Sith",
            },
          },
        ],
      }
    `)
  })
})
