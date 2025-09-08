import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { nhost } from '@/lib/nhost';

export default function HomeScreen() {
  const [movies, setMovies] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

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
        });

        setMovies(resp.body.data.movies || []);
      } catch (err) {
        setError('Failed to fetch movies');
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Error: {error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Movies</ThemedText>
      </ThemedView>
      {movies.map((movie, index) => (
        <ThemedView key={index} style={styles.movieCard}>
          <ThemedText type="subtitle">{movie.title}</ThemedText>
          <ThemedText>Director: {movie.director}</ThemedText>
          <ThemedText>Year: {movie.release_year}</ThemedText>
          <ThemedText>Genre: {movie.genre}</ThemedText>
          <ThemedText>Rating: {movie.rating}</ThemedText>
        </ThemedView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  movieCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
});
