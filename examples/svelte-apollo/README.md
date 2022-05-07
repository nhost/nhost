# Nhost & Svelte Apollo
A sample Svelte 3 app to demonstrate usage of Nhost app using Hasura GraphQL Queries, Mutations and Subscriptions with svelte-apollo. 

# Get started

1. Clone the repository

```sh
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install dependencies

```sh
cd examples/svelte-apollo
npm install
```

3. Get the app URL (something like https://<my-project-name>.nhost.run)
      - Make Changes in apollo.js with your URI
  
4. Go to the Data tab and move to Hasura Console.
    - Create ``author`` table:
  ![Create author table](https://github.com/hasura/graphql-engine/blob/master/community/sample-apps/gatsby-postgres-graphql/assets/add_table.jpg)
  
    - Similarly, create an article table with the following data model:
      table: `article`
      columns: `id`, `title`, `content`, `author_id` (foreign key to `author` table's `id`) and `created_at`
    
    - Now create a relationship from article table to author table by going to the Relationships tab.
  
5. Start the app
  
```bash
npm run dev
```
