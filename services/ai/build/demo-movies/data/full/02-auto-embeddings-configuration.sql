INSERT INTO ai.auto_embeddings_configuration (
  id,
  created_at,
  updated_at,
  name,
  schema_name,
  table_name,
  column_name,
  last_run,
  query,
  mutation,
  model
) VALUES (
  'e2879b3c-2fa0-465b-ae6a-27a1c0606394',
  '2023-11-13 09:51:50.388398+00',
  '2023-11-13 09:51:50.388398+00',
  'movies',
  'public',
  'movies',
  'embeddings',
  NULL,
  $graphql$query GetOutdatedMovies {   movies(where: {     _or: [       {embeddings: {_is_null: true}},       {outdated: {_eq: true}},     ]}) {     id     name     genre     overview     crew   } }$graphql$,
  $graphql$mutation UpdateEmbeddingsMovie(   $id: uuid!,   $embeddings: vector, ) {   updateMovie(     pk_columns: {id: $id},     _set: {       embeddings: $embeddings,     }) {     __typename   } }$graphql$,
  'text-embedding-ada-002'
)
ON CONFLICT (name) DO UPDATE SET
  updated_at = EXCLUDED.updated_at,
  schema_name = EXCLUDED.schema_name,
  table_name = EXCLUDED.table_name,
  column_name = EXCLUDED.column_name,
  last_run = EXCLUDED.last_run,
  query = EXCLUDED.query,
  mutation = EXCLUDED.mutation,
  model = EXCLUDED.model;
