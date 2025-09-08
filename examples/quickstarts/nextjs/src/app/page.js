import { nhost } from '../lib/nhost'

async function getMovies() {
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
    return resp.body?.data?.movies || []
  } catch (error) {
    console.error('Failed to fetch movies:', error)
    return []
  }
}

export default async function Home() {
  const movies = await getMovies()

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
