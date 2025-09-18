"use server";

import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { createNhostClient } from "../../lib/nhost/server";
import type { Todo } from "./page";

// Response types for server actions
type ActionResult<T = void> = {
  success: boolean;
  error?: string;
  todo?: T;
};

// GraphQL response types
interface InsertTodoResponse {
  insert_todos_one: Todo | null;
}

interface UpdateTodoResponse {
  update_todos_by_pk: Todo | null;
}

interface DeleteTodoResponse {
  delete_todos_by_pk: { id: string } | null;
}

export async function addTodo(data: {
  title: string;
  details: string | null;
}): Promise<ActionResult<Todo>> {
  const { title, details } = data;

  if (!title.trim()) {
    return {
      success: false,
      error: "Title is required",
    };
  }

  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Execute GraphQL mutation to insert a new todo
    // user_id is automatically set by Hasura based on JWT token
    const response = await nhost.graphql.request<InsertTodoResponse>({
      query: `
        mutation InsertTodo($title: String!, $details: String) {
          insert_todos_one(object: { title: $title, details: $details }) {
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
      variables: {
        title: title.trim(),
        details: details?.trim() || null,
      },
    });

    if (response.body.errors) {
      return {
        success: false,
        error: response.body.errors[0]?.message || "Failed to add todo",
      };
    }

    if (!response.body?.data?.insert_todos_one) {
      return {
        success: false,
        error: "Failed to add todo",
      };
    }

    return {
      success: true,
      todo: response.body.data.insert_todos_one,
    };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      success: false,
      error: `Failed to add todo: ${error.message}`,
    };
  }
}

export async function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, "title" | "details" | "completed">>,
): Promise<ActionResult<Todo>> {
  if (!id) {
    return {
      success: false,
      error: "Todo ID is required",
    };
  }

  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Execute GraphQL mutation to update an existing todo by primary key
    // Hasura permissions ensure users can only update their own todos
    const response = await nhost.graphql.request<UpdateTodoResponse>({
      query: `
        mutation UpdateTodo($id: uuid!, $updates: todos_set_input!) {
          update_todos_by_pk(pk_columns: { id: $id }, _set: $updates) {
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
      variables: {
        id,
        updates,
      },
    });

    if (response.body.errors) {
      return {
        success: false,
        error: response.body.errors[0]?.message || "Failed to update todo",
      };
    }

    if (!response.body?.data?.update_todos_by_pk) {
      return {
        success: false,
        error: "Failed to update todo",
      };
    }

    return {
      success: true,
      todo: response.body.data.update_todos_by_pk,
    };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      success: false,
      error: `Failed to update todo: ${error.message}`,
    };
  }
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  if (!id) {
    return {
      success: false,
      error: "Todo ID is required",
    };
  }

  try {
    const nhost = await createNhostClient();
    const session = nhost.getUserSession();

    if (!session) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Execute GraphQL mutation to delete a todo by primary key
    // Hasura permissions ensure users can only delete their own todos
    const response = await nhost.graphql.request<DeleteTodoResponse>({
      query: `
        mutation DeleteTodo($id: uuid!) {
          delete_todos_by_pk(id: $id) {
            id
          }
        }
      `,
      variables: {
        id,
      },
    });

    if (response.body.errors) {
      return {
        success: false,
        error: response.body.errors[0]?.message || "Failed to delete todo",
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    const error = err as FetchError<ErrorResponse>;
    return {
      success: false,
      error: `Failed to delete todo: ${error.message}`,
    };
  }
}
