<script context="module">
  import { client } from './apollo'
  import { AUTHORS } from './graphql'

  export async function preload() {
    return {
      authorCache: await client.query({ query: AUTHORS })
    }
  }
</script>

<script>
  import { restore, query } from 'svelte-apollo'
  export let authorCache

  restore(AUTHORS, authorCache)

  const authors = query(AUTHORS)
</script>

<ul>
  {#await $authors}
    <li>Loading...</li>
  {:then result}
    {#each result.data.authors as author}
      <li>{author.name}</li>
    {:else}
      <li>No authors found</li>
    {/each}
  {:catch error}
    <li>Error loading authors: {error}</li>
  {/await}
</ul>
