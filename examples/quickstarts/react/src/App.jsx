import { useEffect, useState } from 'react'
import { nhost } from './lib/nhost'
import './App.css'

function App() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
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

        setMovies(resp.body.data.movies || [])
      } catch (err) {
        setError('Failed to fetch movies')
      } finally {
        setLoading(false)
      }
    }

    fetchMovies()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
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
          {movies.map((movie, index) => (
            <tr key={index}>
              <td>{movie.title}</td>
              <td>{movie.director}</td>
              <td>{movie.release_year}</td>
              <td>{movie.genre}</td>
              <td>{movie.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
