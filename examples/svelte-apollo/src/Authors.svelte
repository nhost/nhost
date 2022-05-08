<script context="module">
  import { client } from './apollo'
  import { AUTHOR_LIST } from './graphql'

  export async function preload() {
    return {
      authorCache: await client.query({ query: AUTHOR_LIST })
    }
  }
</script>

<script>
  import { restore, query } from 'svelte-apollo'
  export let authorCache

  restore(AUTHOR_LIST, authorCache)

  const authors = query(AUTHOR_LIST)
</script>

<ul>
  {#await $authors}
    <li>Loading...</li>
  {:then result}
    {#each result.data.author as author}
      <li>{author.name}</li>
    {:else}
      <li>No authors found</li>
    {/each}
  {:catch error}
    <li>Error loading authors: {error}</li>
  {/await}
</ul>
