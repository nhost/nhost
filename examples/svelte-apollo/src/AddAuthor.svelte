<script>
  import { mutation } from 'svelte-apollo'
  import { gql } from '@apollo/client'
  
  const AUTHORS = gql`
  query {
    authors(order_by: [{ name: asc }]) {
      name
    }
  }
`
  const ADD_AUTHOR = gql`
    mutation ($authors: authors_insert_input!) {
      insert_author(objects: [$authors) {
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
          const existingAuthors = cache.readQuery({ query: AUTHORS })
          const newAuthors = [...existingAuthors.author, { name, __typename: 'authors' }]
          cache.writeQuery({ query: AUTHORS, data: { author: newAuthors } })
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
  <label for="authors">Author</label>
  <input type="text" id="author-name" bind:value={name} />
  <button type="submit">Add Author</button>
</form>
