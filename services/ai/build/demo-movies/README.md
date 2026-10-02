# Demo: Movies

This demo uses the AI service to generate embeddings and deploy similarity-search functionality automatically.

## Starting

```bash
make demo-movies-up

# this will be integrated into mimir/cli
export OPENAI_API_KEY=YOUR-OPENAI-KEY
export AI_BASE_URL=http://host.docker.internal:8090
export AI_WEBHOOK_SECRET=ai-secret
go run main.go serve
```

## Configuring AI auto-embeddings

To configure AI auto-embeddings you need the following information:

1. `name` - A unique name used to generate related objects and functions.
2. `schema` and `table` - The source table for the embeddings.
3. `column` - The column where embeddings are stored.
4. GraphQL `query` - Fetches movies that need updating and receives `lastRun`, the last time embeddings were generated.
5. GraphQL `mutation` - Updates a movie's embeddings and receives `id`, `embeddings`, and `updatedAt`.

For our particular demo this will be our data:

1. `name`: `movies`
2. `schemaName`: `public`
3. `tableName`: `movies`
4. `columnName`: `embeddings_search`
5. A GraphQL `query` that fetches 20 movies at a time when embeddings are missing or outdated:

   ``` graphql
   query GetMovies($lastRun: timestamptz!) {
     movies(where: {
       _or: [
         {embeddingsSearchUpdatedAt: {_gte: $lastRun}},
         {embeddingsSearch: {_is_null: true},
       }]}, limit: 20) {
       id
       name
       genre
       overview
       crew
       embeddingsSearch
     }
   }
   ```

6. A GraphQL `mutation` that sets `embeddingsSearch` and `embeddingsSearchUpdatedAt`:

``` graphql
mutation updateMovie(
  $id: uuid!,
  $embeddings: vector,
  $updatedAt: timestamptz,
) {
  updateMovie(
    pk_columns: {id: $id},
    _set: {
      embeddingsSearch: $embeddings,
      embeddingsSearchUpdatedAt: $updatedAt,
    }) {
    __typename
  }
}
```
