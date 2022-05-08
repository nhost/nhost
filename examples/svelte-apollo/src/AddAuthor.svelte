<script>
  import { mutation } from 'svelte-apollo'
  import { gql } from '@apollo/client'
  import { AUTHOR_LIST } from './graphql'

  const ADD_AUTHOR = gql`
    mutation ($name: String!) {
      insert_author(objects: [{ name: $name }]) {
        affected_rows
      }
    }
  `
  let name = ''

  const mutate = mutation(ADD_AUTHOR)
  async function addAuthor(e) {
    e.preventDefault()
    try {
      await mutate({
        variables: { name },
        update: (cache) => {
          const existingAuthors = cache.readQuery({ query: AUTHOR_LIST })
          const newAuthors = [...existingAuthors.author, { name, __typename: 'author' }]
          cache.writeQuery({ query: AUTHOR_LIST, data: { author: newAuthors } })
        }
      })
      alert('Added successfully')
      name = ''
    } catch (error) {
      console.error(error)
    }
  }
</script>

<form on:submit={addAuthor}>
  <label for="author">Author</label>
  <input type="text" id="author-name" bind:value={name} />
  <button type="submit">Add Author</button>
</form>
