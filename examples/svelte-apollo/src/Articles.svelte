<script context="module">
  import { gql } from '@apollo/client'
  import { client } from './apollo'

  export const ARTICLES = gql`
    {
      articles {
        id
        title
        author {
          id
        }
      }
    }
  `
  export async function preload() {
    return {
      articleCache: await client.query({ query: ARTICLES })
    }
  }
</script>

<script>
  import { restore, query } from 'svelte-apollo'

  export let articleCache
  restore(ARTICLES, articleCache)

  const articles = query(ARTICLES)
</script>

<ul>
  {#await $articles}
    <li>Loading...</li>
  {:then result}
    {#each result.data.articles as article}
      <li>{article.title}</li>
    {:else}
      <li>No articles found</li>
    {/each}
  {:catch error}
    <li>Error loading articles: {error}</li>
  {/await}
</ul>
