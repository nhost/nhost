<script>
  import { onMount } from 'svelte'
  import { nhost } from './lib/nhost'

  let movies = []
  let loading = true
  let error = null

  onMount(async () => {
    try {
      const resp = await nhost.graphql.request({
        query: `query GetMovies {
          movies {
            title
            director
            release_year
            genre
            rating
          }
        }`,
      })

      movies = resp.body.data.movies || []
    } catch (err) {
      error = 'Failed to fetch movies'
    } finally {
      loading = false
    }
  })
</script>

{#if loading}
  <div>Loading...</div>
{:else if error}
  <div>Error: {error}</div>
{:else}
  <div>
    <h1>Movies</h1>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Director</th>
          <th>Release Year</th>
          <th>Genre</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        {#each movies as movie, index (index)}
          <tr>
            <td>{movie.title}</td>
            <td>{movie.director}</td>
            <td>{movie.release_year}</td>
            <td>{movie.genre}</td>
            <td>{movie.rating}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
