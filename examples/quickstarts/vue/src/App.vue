<script setup>
import { ref, onMounted } from 'vue'
import { nhost } from './lib/nhost'

const movies = ref([])
const loading = ref(true)
const error = ref(null)

const fetchMovies = async () => {
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

    movies.value = resp.body.data.movies || []
  } catch (err) {
    error.value = 'Failed to fetch movies'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchMovies()
})
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <div v-else>
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
        <tr v-for="(movie, index) in movies" :key="index">
          <td>{{ movie.title }}</td>
          <td>{{ movie.director }}</td>
          <td>{{ movie.release_year }}</td>
          <td>{{ movie.genre }}</td>
          <td>{{ movie.rating }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
