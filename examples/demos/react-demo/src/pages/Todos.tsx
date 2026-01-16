import type { JSX } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';

interface Todo {
  id: string;
  title: string;
  details: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface GetTodos {
  todos: Todo[];
}

interface InsertTodo {
  insert_todos_one: Todo | null;
}

interface UpdateTodo {
  update_todos_by_pk: Todo | null;
}

export default function Todos(): JSX.Element {
  const { nhost, session } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDetails, setNewTodoDetails] = useState('');
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());

  const titleId = useId();
  const detailsId = useId();

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
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

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to fetch todos',
        );
      }

      setTodos(response.body?.data?.todos || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch todos');
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    try {
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
          response.body.errors[0]?.message || 'Failed to add todo',
        );
      }

      if (!response.body?.data?.insert_todos_one) {
        throw new Error('Failed to add todo');
      }
      setTodos([response.body?.data?.insert_todos_one, ...todos]);
      setNewTodoTitle('');
      setNewTodoDetails('');
      setShowAddForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add todo');
    }
  };

  const updateTodo = async (
    id: string,
    updates: Partial<Pick<Todo, 'title' | 'details' | 'completed'>>,
  ) => {
    try {
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
          response.body.errors[0]?.message || 'Failed to update todo',
        );
      }

      if (!response.body?.data?.update_todos_by_pk) {
        throw new Error('Failed to update todo');
      }

      const updatedTodo = response.body?.data?.update_todos_by_pk;
      if (updatedTodo) {
        setTodos(todos.map((todo) => (todo.id === id ? updatedTodo : todo)));
      }
      setEditingTodo(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
    }
  };

  const deleteTodo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this todo?')) return;

    try {
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
          response.body.errors[0]?.message || 'Failed to delete todo',
        );
      }

      setTodos(todos.filter((todo) => todo.id !== id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete todo');
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

  useEffect(() => {
    if (session) {
      fetchTodos();
    }
  }, [session, fetchTodos]);

  if (!session) {
    return (
      <div className="text-center">
        <p>Please sign in to view your todos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold gradient-text">My Todos</h1>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="add-todo-text-btn"
            title="Add a new todo"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Add new todo form */}
      {showAddForm && (
        <div className="glass-card mb-8">
          <form onSubmit={addTodo} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add New Todo</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewTodoTitle('');
                  setNewTodoDetails('');
                }}
                className="action-icon action-icon-delete"
                title="Cancel"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
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
              <div>
                <label htmlFor={detailsId}>Details</label>
                <textarea
                  id={detailsId}
                  value={newTodoDetails}
                  onChange={(e) => setNewTodoDetails(e.target.value)}
                  placeholder="Add some details (optional)..."
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="btn btn-primary flex-1">
                  <svg
                    className="w-4 h-4 mr-2 inline-block"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Todo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTodoTitle('');
                    setNewTodoDetails('');
                  }}
                  className="btn btn-secondary"
                  style={{
                    backgroundColor: 'var(--text-muted)',
                    color: 'white',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Todos list */}
      {!showAddForm &&
        (loading ? (
          <div className="loading-container">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-secondary">Loading todos...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {todos.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-muted"
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
                <h3 className="text-lg font-medium mb-2">No todos yet</h3>
                <p className="text-muted">
                  Create your first todo to get started!
                </p>
              </div>
            ) : (
              todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`glass-card transition-all duration-200 ${
                    todo.completed ? 'opacity-75' : 'hover:shadow-lg'
                  }`}
                >
                  {editingTodo?.id === todo.id ? (
                    /* Edit mode */
                    <div className="p-6">
                      <div className="space-y-4">
                        <div>
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
                        <div>
                          <label htmlFor={`${detailsId}-edit`}>Details</label>
                          <textarea
                            id={`${detailsId}-edit`}
                            value={editingTodo.details || ''}
                            onChange={(e) =>
                              setEditingTodo({
                                ...editingTodo,
                                details: e.target.value,
                              })
                            }
                            rows={3}
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="btn btn-secondary flex-1"
                          >
                            <svg
                              className="w-4 h-4 mr-2 inline-block"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTodo(null)}
                            className="btn btn-secondary flex-1"
                            style={{
                              backgroundColor: 'var(--text-muted)',
                              color: 'white',
                            }}
                          >
                            <svg
                              className="w-4 h-4 mr-2 inline-block"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <button
                          type="button"
                          className={`text-xl font-medium transition-all cursor-pointer hover:text-primary-hover text-left ${
                            todo.completed
                              ? 'line-through text-muted'
                              : 'text-primary'
                          }`}
                          onClick={() => toggleTodoExpansion(todo.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          {todo.title}
                        </button>
                        <div className="table-actions">
                          <button
                            type="button"
                            onClick={() => toggleComplete(todo)}
                            className="action-icon action-icon-view"
                            title={
                              todo.completed
                                ? 'Mark as incomplete'
                                : 'Mark as complete'
                            }
                          >
                            {todo.completed ? (
                              <svg
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                />
                              </svg>
                            ) : (
                              <svg
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTodo(todo)}
                            className="action-icon action-icon-view"
                            title="Edit todo"
                          >
                            <svg
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTodo(todo.id)}
                            className="action-icon action-icon-delete"
                            title="Delete todo"
                          >
                            <svg
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {expandedTodos.has(todo.id) && (
                        <div className="mt-4 space-y-3">
                          {todo.details && (
                            <div
                              className={`p-3 rounded bg-card-bg border border-border-color ${
                                todo.completed ? 'opacity-75' : ''
                              }`}
                            >
                              <p
                                className={`text-secondary leading-relaxed ${todo.completed ? 'line-through' : ''}`}
                              >
                                {todo.details}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-3">
                              <span className="flex items-center space-x-1 text-muted">
                                <span>
                                  Created:{' '}
                                  {new Date(todo.created_at).toLocaleString()}
                                </span>
                              </span>
                              <span className="flex items-center space-x-1 text-muted">
                                Updated:{' '}
                                <span>
                                  {new Date(todo.updated_at).toLocaleString()}
                                </span>
                              </span>
                            </div>
                            {todo.completed && (
                              <div className="flex items-center space-x-1 text-secondary">
                                <svg
                                  className="w-3 h-3"
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
                                <span className="text-xs font-medium">
                                  Completed
                                </span>
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
