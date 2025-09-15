<template>
  <div v-if="!session" class="auth-message">
    <p>Please sign in to view your todos.</p>
  </div>

  <div v-else class="container">
    <header class="page-header">
      <h1 class="page-title">
        My Todos
        <button
          v-if="!showAddForm"
          type="button"
          @click="showAddForm = true"
          class="add-todo-btn"
          title="Add a new todo"
        >
          +
        </button>
      </h1>
    </header>

    <div v-if="error" class="error-message">
      <strong>Error:</strong> {{ error }}
    </div>

    <div v-if="showAddForm" class="todo-form-card">
      <form @submit.prevent="addTodo" class="todo-form">
        <h2 class="form-title">Add New Todo</h2>
        <div class="form-fields">
          <div class="field-group">
            <label :for="titleId">Title *</label>
            <input
              :id="titleId"
              type="text"
              v-model="newTodoTitle"
              placeholder="What needs to be done?"
              required
            />
          </div>
          <div class="field-group">
            <label :for="detailsId">Details</label>
            <textarea
              :id="detailsId"
              v-model="newTodoDetails"
              placeholder="Add some details (optional)..."
              :rows="3"
            />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              Add Todo
            </button>
            <button
              type="button"
              @click="cancelAddForm"
              class="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>

    <div v-if="!showAddForm">
      <div v-if="loading" class="loading-container">
        <div class="loading-content">
          <div class="spinner"></div>
          <span class="loading-text">Loading todos...</span>
        </div>
      </div>

      <div v-else class="todos-list">
        <div v-if="todos.length === 0" class="empty-state">
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
              :stroke-width="1.5"
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 class="empty-title">No todos yet</h3>
          <p class="empty-description">
            Create your first todo to get started!
          </p>
        </div>

        <div
          v-else
          v-for="todo in todos"
          :key="todo.id"
          :class="['todo-card', { completed: todo.completed }]"
        >
          <div v-if="editingTodo?.id === todo.id" class="todo-edit">
            <div class="edit-fields">
              <div class="field-group">
                <label :for="`${titleId}-edit`">Title</label>
                <input
                  :id="`${titleId}-edit`"
                  type="text"
                  v-model="editingTodo.title"
                />
              </div>
              <div class="field-group">
                <label :for="`${detailsId}-edit`">Details</label>
                <textarea
                  :id="`${detailsId}-edit`"
                  v-model="editingTodo.details"
                  :rows="3"
                />
              </div>
              <div class="edit-actions">
                <button
                  type="button"
                  @click="saveEdit"
                  class="btn btn-primary"
                >
                  ✓ Save Changes
                </button>
                <button
                  type="button"
                  @click="editingTodo = null"
                  class="btn btn-cancel"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>

          <div v-else class="todo-content">
            <div class="todo-header">
              <button
                type="button"
                :class="['todo-title-btn', { completed: todo.completed }]"
                @click="toggleTodoExpansion(todo.id)"
              >
                {{ todo.title }}
              </button>
              <div class="todo-actions">
                <button
                  type="button"
                  @click="toggleComplete(todo)"
                  class="action-btn action-btn-complete"
                  :title="todo.completed ? 'Mark as incomplete' : 'Mark as complete'"
                >
                  {{ todo.completed ? "↶" : "✓" }}
                </button>
                <button
                  type="button"
                  @click="editingTodo = todo"
                  class="action-btn action-btn-edit"
                  title="Edit todo"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  @click="deleteTodo(todo.id)"
                  class="action-btn action-btn-delete"
                  title="Delete todo"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div v-if="expandedTodos.has(todo.id)" class="todo-details">
              <div
                v-if="todo.details"
                :class="['todo-description', { completed: todo.completed }]"
              >
                <p>{{ todo.details }}</p>
              </div>

              <div class="todo-meta">
                <div class="meta-dates">
                  <span class="meta-item">
                    Created: {{ new Date(todo.created_at).toLocaleString() }}
                  </span>
                  <span class="meta-item">
                    Updated: {{ new Date(todo.updated_at).toLocaleString() }}
                  </span>
                </div>
                <div v-if="todo.completed" class="completion-badge">
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
                      :stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Completed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, useId } from "vue";
import { useAuth } from "../lib/nhost/auth";

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

const { nhost, session } = useAuth();

const todos = ref<Todo[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const newTodoTitle = ref("");
const newTodoDetails = ref("");
const editingTodo = ref<Todo | null>(null);
const showAddForm = ref(false);
const expandedTodos = ref<Set<string>>(new Set());

const titleId = useId();
const detailsId = useId();

const fetchTodos = async () => {
  try {
    loading.value = true;
    // Make GraphQL request to fetch todos using Nhost client
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
      throw new Error(
        response.body.errors[0]?.message || "Failed to fetch todos",
      );
    }

    // Extract todos from the GraphQL response data
    todos.value = response.body?.data?.todos || [];
    error.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to fetch todos";
  } finally {
    loading.value = false;
  }
};

const addTodo = async () => {
  if (!newTodoTitle.value.trim()) return;

  try {
    // Execute GraphQL mutation to insert a new todo
    // user_id is automatically set by Hasura based on JWT token
    const response = await nhost.graphql.request<InsertTodo>({
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
        title: newTodoTitle.value.trim(),
        details: newTodoDetails.value.trim() || null,
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
    todos.value = [response.body?.data?.insert_todos_one, ...todos.value];
    newTodoTitle.value = "";
    newTodoDetails.value = "";
    showAddForm.value = false;
    error.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to add todo";
  }
};

const updateTodo = async (
  id: string,
  updates: Partial<Pick<Todo, "title" | "details" | "completed">>,
) => {
  try {
    // Execute GraphQL mutation to update an existing todo by primary key
    // Hasura permissions ensure users can only update their own todos
    const response = await nhost.graphql.request<UpdateTodo>({
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
      todos.value = todos.value.map((todo) => (todo.id === id ? updatedTodo : todo));
    }
    editingTodo.value = null;
    error.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to update todo";
  }
};

const deleteTodo = async (id: string) => {
  if (!confirm("Are you sure you want to delete this todo?")) return;

  try {
    // Execute GraphQL mutation to delete a todo by primary key
    // Hasura permissions ensure users can only delete their own todos
    const response = await nhost.graphql.request({
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

    todos.value = todos.value.filter((todo) => todo.id !== id);
    error.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to delete todo";
  }
};

const toggleComplete = async (todo: Todo) => {
  await updateTodo(todo.id, { completed: !todo.completed });
};

const saveEdit = async () => {
  if (!editingTodo.value) return;
  await updateTodo(editingTodo.value.id, {
    title: editingTodo.value.title,
    details: editingTodo.value.details,
  });
};

const toggleTodoExpansion = (todoId: string) => {
  const newExpanded = new Set(expandedTodos.value);
  if (newExpanded.has(todoId)) {
    newExpanded.delete(todoId);
  } else {
    newExpanded.add(todoId);
  }
  expandedTodos.value = newExpanded;
};

const cancelAddForm = () => {
  showAddForm.value = false;
  newTodoTitle.value = "";
  newTodoDetails.value = "";
};

// Fetch todos when user session is available
// The session contains the JWT token needed for GraphQL authentication
onMounted(() => {
  if (session.value) {
    fetchTodos();
  }
});
</script>
