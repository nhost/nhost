<script>
  import { mutation } from 'svelte-apollo'
  import { gql } from '@apollo/client'

  const ARTICLES = gql`
    query {
      articles(order_by: [{ title: asc }]) {
        title
      }
    }
  `
  const ADD_ARTICLE = gql`
    mutation ($article:s articles_insert_input!) {
      insert_article(objects: [$articles]) {
        affected_rows
      }
    }
  `
  let title = ''
  let content = ''
  let author_id = ''

  const mutate = mutation(ADD_ARTICLE)
  async function addArticle(e) {
    e.preventDefault()
    try {
      await mutate({
        variables: { title, content, author_id },
        update: (cache) => {
          const existingArticles = cache.readQuery({ query: ARTICLES })
          const newArticles = [
            ...existingArticles.article,
            { title, content, author_id, __typename: 'articles' }
          ]
          cache.writeQuery({ query: ARTICLES, data: { article: newArticles } })
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

<form on:submit={addArticle}>
  <label for="articles">Article</label>
  <input type="text" id="article-title" bind:value={title} />
  <input type="text" id="article-content" bind:value={content} />
  <input type="text" id="article-author_id" bind:value={author_id} />
  <button type="submit">Add Article</button>
</form>
