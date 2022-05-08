<script>
  import { mutation } from 'svelte-apollo'
  import { gql } from '@apollo/client'

  const ARTICLE_LIST = gql`
    query {
      article(order_by: [{ title: asc }]) {
        title
      }
    }
  `
  const ADD_ARTICLE = gql`
    mutation ($title: String!, $content: String!, $author_id: Int!) {
      insert_article(objects: [{ title: $title, content: $content, author_id: $author_id }]) {
        affected_rows
      }
    }
  `
  let title = ''
  let content = ''
  let author_id = ''

  const mutate = mutation(ADD_ARTICLE)
  async function addArticles(e) {
    e.preventDefault()
    try {
      await mutate({
        variables: { title, content, author_id },
        update: (cache) => {
          const existingArticles = cache.readQuery({ query: ARTICLE_LIST })
          const newArticles = [
            ...existingArticles.article,
            { title, content, author_id, __typename: 'article' }
          ]
          cache.writeQuery({ query: ARTICLE_LIST, data: { article: newArticles } })
        }
      })
      alert('Added successfully')
      // clear input
      title = ''
      content = ''
      author_id = ''
    } catch (error) {
      console.error(error)
    }
  }
</script>

<form on:submit={addArticles}>
  <label for="article">Article</label>
  <input type="text" id="article-title" bind:value={title} />
  <input type="text" id="article-content" bind:value={content} />
  <input type="text" id="article-author_id" bind:value={author_id} />
  <button type="submit">Add Article</button>
</form>
