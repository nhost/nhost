import type { JSX } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";


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

export default function Todos(): JSX.Element {
  const { nhost, session } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDetails, setNewTodoDetails] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());

  const titleId = useId();
  const detailsId = useId();

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
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
      setTodos(response.body?.data?.todos || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

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
      setTodos([response.body?.data?.insert_todos_one, ...todos]);
      setNewTodoTitle("");
      setNewTodoDetails("");
      setShowAddForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add todo");
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
        setTodos(todos.map((todo) => (todo.id === id ? updatedTodo : todo)));
      }
      setEditingTodo(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo");
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

      setTodos(todos.filter((todo) => todo.id !== id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo");
    }
  };

  const toggleComplete = async (todo: Todo) => {
    await updateTodo(todo.id, { completed: !todo.completed });
  };

  const saveEdit = async () => {
    if (!editingTodo) return;
    await updateTodo(editingTodo.id, {
      title: editingTodo.title,
      details: editingTodo.details,
    });
  };

  const toggleTodoExpansion = (todoId: string) => {
    const newExpanded = new Set(expandedTodos);
    if (newExpanded.has(todoId)) {
      newExpanded.delete(todoId);
    } else {
      newExpanded.add(todoId);
    }
    setExpandedTodos(newExpanded);
  };

  // Fetch todos when user session is available
  // The session contains the JWT token needed for GraphQL authentication
  useEffect(() => {
    if (session) {
      fetchTodos();
    }
  }, [session, fetchTodos]);

  if (!session) {
    return (
      <div className="auth-message">
        <p>Please sign in to view your todos.</p>
      </div>
    );
  }

  return (
    <div className="todos-container">
      <header className="todos-header">
        <h1 className="todos-title">
          My Todos
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="add-todo-btn"
              title="Add a new todo"
            >
              +
            </button>
          )}
        </h1>
      </header>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {showAddForm && (
        <div className="todo-form-card">
          <form onSubmit={addTodo} className="todo-form">
            <h2 className="form-title">Add New Todo</h2>
            <div className="form-fields">
              <div className="field-group">
                <label htmlFor={titleId}>Title *</label>
                <input
                  id={titleId}
                  type="text"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor={detailsId}>Details</label>
                <textarea
                  id={detailsId}
                  value={newTodoDetails}
                  onChange={(e) => setNewTodoDetails(e.target.value)}
                  placeholder="Add some details (optional)..."
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Add Todo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTodoTitle("");
                    setNewTodoDetails("");
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {!showAddForm &&
        (loading ? (
          <div className="loading-container">
            <div className="loading-content">
              <div className="spinner"></div>
              <span className="loading-text">Loading todos...</span>
            </div>
          </div>
        ) : (
          <div className="todos-list">
            {todos.length === 0 ? (
              <div className="empty-state">
                <svg
                  className="empty-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h3 className="empty-title">No todos yet</h3>
                <p className="empty-description">
                  Create your first todo to get started!
                </p>
              </div>
            ) : (
              todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`todo-card ${todo.completed ? 'completed' : ''}`}
                >
                  {editingTodo?.id === todo.id ? (
                    <div className="todo-edit">
                      <div className="edit-fields">
                        <div className="field-group">
                          <label htmlFor={`${titleId}-edit`}>Title</label>
                          <input
                            id={`${titleId}-edit`}
                            type="text"
                            value={editingTodo.title}
                            onChange={(e) =>
                              setEditingTodo({
                                ...editingTodo,
                                title: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="field-group">
                          <label htmlFor={`${detailsId}-edit`}>Details</label>
                          <textarea
                            id={`${detailsId}-edit`}
                            value={editingTodo.details || ""}
                            onChange={(e) =>
                              setEditingTodo({
                                ...editingTodo,
                                details: e.target.value,
                              })
                            }
                            rows={3}
                          />
                        </div>
                        <div className="edit-actions">
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="btn btn-primary"
                          >
                            ✓ Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTodo(null)}
                            className="btn btn-cancel"
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="todo-content">
                      <div className="todo-header">
                        <button
                          type="button"
                          className={`todo-title-btn ${todo.completed ? 'completed' : ''}`}
                          onClick={() => toggleTodoExpansion(todo.id)}
                        >
                          {todo.title}
                        </button>
                        <div className="todo-actions">
                          <button
                            type="button"
                            onClick={() => toggleComplete(todo)}
                            className="action-btn action-btn-complete"
                            title={
                              todo.completed
                                ? "Mark as incomplete"
                                : "Mark as complete"
                            }
                          >
                            {todo.completed ? "↶" : "✓"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTodo(todo)}
                            className="action-btn action-btn-edit"
                            title="Edit todo"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTodo(todo.id)}
                            className="action-btn action-btn-delete"
                            title="Delete todo"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {expandedTodos.has(todo.id) && (
                        <div className="todo-details">
                          {todo.details && (
                            <div className={`todo-description ${todo.completed ? 'completed' : ''}`}>
                              <p>{todo.details}</p>
                            </div>
                          )}

                          <div className="todo-meta">
                            <div className="meta-dates">
                              <span className="meta-item">
                                Created: {new Date(todo.created_at).toLocaleString()}
                              </span>
                              <span className="meta-item">
                                Updated: {new Date(todo.updated_at).toLocaleString()}
                              </span>
                            </div>
                            {todo.completed && (
                              <div className="completion-badge">
                                <svg
                                  className="completion-icon"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span>Completed</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ))}
    </div>
  );
}
