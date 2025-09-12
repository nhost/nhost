import { createNhostClient } from "../../lib/nhost/server";
import TodosClient from "./TodosClient";

// The interfaces below define the structure of our data
// They are not strictly necessary but help with type safety

// Represents a single todo item
export interface Todo {
  id: string;
  title: string;
  details: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// This matches the GraphQL response structure for fetching todos
// Can be used as a generic type on the request method
interface GetTodos {
  todos: Todo[];
}

export default async function TodosPage() {
  // Fetch initial todos data server-side
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  let initialTodos: Todo[] = [];
  let error: string | null = null;

  if (session) {
    try {
      // Make GraphQL request to fetch todos using Nhost server client
      // The query automatically filters by user_id due to Hasura permissions
      const response = await nhost.graphql.request<GetTodos>({
        query: `
          query GetTodos {
            todos(order_by: { created_at: desc }) {
              id
              title
              details
              completed
              created_at
              updated_at
              user_id
            }
          }
        `,
      });

      // Check for GraphQL errors in the response body
      if (response.body.errors) {
        error = response.body.errors[0]?.message || "Failed to fetch todos";
      } else {
        // Extract todos from the GraphQL response data
        initialTodos = response.body?.data?.todos || [];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch todos";
    }
  }

  return (
    <TodosClient initialTodos={initialTodos} initialError={error} />
  );
}
