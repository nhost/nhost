<script lang="ts">
import { goto } from "$app/navigation";
import { auth } from "$lib/nhost/auth";

// The interfaces below define the structure of our data
// They are not strictly necessary but help with type safety

// Represents a single todo item
interface Todo {
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

// This matches the GraphQL response structure for inserting a todo
// Can be used as a generic type on the request method
interface InsertTodo {
  insert_todos_one: Todo | null;
}

// This matches the GraphQL response structure for updating a todo
// Can be used as a generic type on the request method
interface UpdateTodo {
  update_todos_by_pk: Todo | null;
}

let todos = $state<Todo[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let newTodoTitle = $state("");
let newTodoDetails = $state("");
let editingTodo = $state<Todo | null>(null);
let showAddForm = $state(false);
let expandedTodos = $state<Set<string>>(new Set());

// Redirect if not authenticated
$effect(() => {
  if (!$auth.isLoading && !$auth.isAuthenticated) {
    void goto("/signin");
  }
});

async function fetchTodos() {
  try {
    loading = true;
    // Make GraphQL request to fetch todos using Nhost client
    // The query automatically filters by user_id due to Hasura permissions
    const response = await $auth.nhost.graphql.request<GetTodos>({
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
      throw new Error(
        response.body.errors[0]?.message || "Failed to fetch todos",
      );
    }

    // Extract todos from the GraphQL response data
    todos = response.body?.data?.todos || [];
    error = null;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to fetch todos";
  } finally {
    loading = false;
  }
}

async function addTodo(e: SubmitEvent) {
  e.preventDefault();
  if (!newTodoTitle.trim()) return;

  try {
    // Execute GraphQL mutation to insert a new todo
    // user_id is automatically set by Hasura based on JWT token
    const response = await $auth.nhost.graphql.request<InsertTodo>({
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
        title: newTodoTitle.trim(),
        details: newTodoDetails.trim() || null,
      },
    });

    if (response.body.errors) {
      throw new Error(
        response.body.errors[0]?.message || "Failed to add todo",
      );
    }

    if (!response.body?.data?.insert_todos_one) {
      throw new Error("Failed to add todo");
    }
    todos = [response.body?.data?.insert_todos_one, ...todos];
    newTodoTitle = "";
    newTodoDetails = "";
    showAddForm = false;
    error = null;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to add todo";
  }
}

async function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, "title" | "details" | "completed">>,
) {
  try {
    // Execute GraphQL mutation to update an existing todo by primary key
    // Hasura permissions ensure users can only update their own todos
    const response = await $auth.nhost.graphql.request<UpdateTodo>({
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
      throw new Error(
        response.body.errors[0]?.message || "Failed to update todo",
      );
    }

    if (!response.body?.data?.update_todos_by_pk) {
      throw new Error("Failed to update todo");
    }

    const updatedTodo = response.body?.data?.update_todos_by_pk;
    if (updatedTodo) {
      todos = todos.map((todo) => (todo.id === id ? updatedTodo : todo));
    }
    editingTodo = null;
    error = null;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to update todo";
  }
}

async function deleteTodo(id: string) {
  if (!confirm("Are you sure you want to delete this todo?")) return;

  try {
    // Execute GraphQL mutation to delete a todo by primary key
    // Hasura permissions ensure users can only delete their own todos
    const response = await $auth.nhost.graphql.request({
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
      throw new Error(
        response.body.errors[0]?.message || "Failed to delete todo",
      );
    }

    todos = todos.filter((todo) => todo.id !== id);
    error = null;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to delete todo";
  }
}

async function toggleComplete(todo: Todo) {
  await updateTodo(todo.id, { completed: !todo.completed });
}

async function saveEdit() {
  if (!editingTodo) return;
  await updateTodo(editingTodo.id, {
    title: editingTodo.title,
    details: editingTodo.details,
  });
}

function toggleTodoExpansion(todoId: string) {
  const newExpanded = new Set(expandedTodos);
  if (newExpanded.has(todoId)) {
    newExpanded.delete(todoId);
  } else {
    newExpanded.add(todoId);
  }
  expandedTodos = newExpanded;
}

// Fetch todos when user session is available
// The session contains the JWT token needed for GraphQL authentication
$effect(() => {
  if ($auth.session) {
    fetchTodos();
  }
});
</script>

{#if !$auth.session}
  <div class="auth-message">
    <p>Please sign in to view your todos.</p>
  </div>
{:else}
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">
        My Todos
        {#if !showAddForm}
          <button
            type="button"
            onclick={() => (showAddForm = true)}
            class="add-todo-btn"
            title="Add a new todo"
          >
            +
          </button>
        {/if}
      </h1>
    </header>

    {#if error}
      <div class="error-message">
        <strong>Error:</strong> {error}
      </div>
    {/if}

    {#if showAddForm}
      <div class="todo-form-card">
        <form onsubmit={addTodo} class="todo-form">
          <h2 class="form-title">Add New Todo</h2>
          <div class="form-fields">
            <div class="field-group">
              <label for="title">Title *</label>
              <input
                id="title"
                type="text"
                bind:value={newTodoTitle}
                placeholder="What needs to be done?"
                required
              />
            </div>
            <div class="field-group">
              <label for="details">Details</label>
              <textarea
                id="details"
                bind:value={newTodoDetails}
                placeholder="Add some details (optional)..."
                rows="3"
              ></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                Add Todo
              </button>
              <button
                type="button"
                onclick={() => {
                  showAddForm = false;
                  newTodoTitle = "";
                  newTodoDetails = "";
                }}
                class="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    {/if}

    {#if !showAddForm}
      {#if loading}
        <div class="loading-container">
          <div class="loading-content">
            <div class="spinner"></div>
            <span class="loading-text">Loading todos...</span>
          </div>
        </div>
      {:else}
        <div class="todos-list">
          {#if todos.length === 0}
            <div class="empty-state">
              <svg
                class="empty-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 class="empty-title">No todos yet</h3>
              <p class="empty-description">
                Create your first todo to get started!
              </p>
            </div>
          {:else}
            {#each todos as todo (todo.id)}
              <div class="todo-card {todo.completed ? 'completed' : ''}">
                {#if editingTodo?.id === todo.id}
                  <div class="todo-edit">
                    <div class="edit-fields">
                      <div class="field-group">
                        <label for="edit-title">Title</label>
                        <input
                          id="edit-title"
                          type="text"
                          bind:value={editingTodo.title}
                        />
                      </div>
                      <div class="field-group">
                        <label for="edit-details">Details</label>
                        <textarea
                          id="edit-details"
                          bind:value={editingTodo.details}
                          rows="3"
                        ></textarea>
                      </div>
                      <div class="edit-actions">
                        <button
                          type="button"
                          onclick={saveEdit}
                          class="btn btn-primary"
                        >
                          ✓ Save Changes
                        </button>
                        <button
                          type="button"
                          onclick={() => (editingTodo = null)}
                          class="btn btn-cancel"
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class="todo-content">
                    <div class="todo-header">
                      <button
                        type="button"
                        class="todo-title-btn {todo.completed ? 'completed' : ''}"
                        onclick={() => toggleTodoExpansion(todo.id)}
                      >
                        {todo.title}
                      </button>
                      <div class="todo-actions">
                        <button
                          type="button"
                          onclick={() => toggleComplete(todo)}
                          class="action-btn action-btn-complete"
                          title={todo.completed
                            ? "Mark as incomplete"
                            : "Mark as complete"}
                        >
                          {todo.completed ? "↶" : "✓"}
                        </button>
                        <button
                          type="button"
                          onclick={() => (editingTodo = todo)}
                          class="action-btn action-btn-edit"
                          title="Edit todo"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onclick={() => deleteTodo(todo.id)}
                          class="action-btn action-btn-delete"
                          title="Delete todo"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {#if expandedTodos.has(todo.id)}
                      <div class="todo-details">
                        {#if todo.details}
                          <div class="todo-description {todo.completed ? 'completed' : ''}">
                            <p>{todo.details}</p>
                          </div>
                        {/if}

                        <div class="todo-meta">
                          <div class="meta-dates">
                            <span class="meta-item">
                              Created: {new Date(todo.created_at).toLocaleString()}
                            </span>
                            <span class="meta-item">
                              Updated: {new Date(todo.updated_at).toLocaleString()}
                            </span>
                          </div>
                          {#if todo.completed}
                            <div class="completion-badge">
                              <svg
                                class="completion-icon"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span>Completed</span>
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/if}
