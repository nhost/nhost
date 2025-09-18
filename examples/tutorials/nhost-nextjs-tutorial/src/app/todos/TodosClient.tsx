"use client";

import { useId, useState } from "react";
import { addTodo, deleteTodo, updateTodo } from "./actions";
import type { Todo } from "./page";

interface TodosClientProps {
  initialTodos: Todo[];
  initialError: string | null;
}

export default function TodosClient({
  initialTodos,
  initialError,
}: TodosClientProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [error, setError] = useState<string | null>(initialError);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDetails, setNewTodoDetails] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const titleId = useId();
  const detailsId = useId();

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    setIsLoading(true);
    try {
      // Call server action to add todo
      const result = await addTodo({
        title: newTodoTitle.trim(),
        details: newTodoDetails.trim() || null,
      });

      if (result.success && result.todo) {
        setTodos([result.todo, ...todos]);
        setNewTodoTitle("");
        setNewTodoDetails("");
        setShowAddForm(false);
        setError(null);
      } else {
        setError(result.error || "Failed to add todo");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add todo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTodo = async (
    id: string,
    updates: Partial<Pick<Todo, "title" | "details" | "completed">>,
  ) => {
    try {
      // Call server action to update todo
      const result = await updateTodo(id, updates);

      if (result.success && result.todo) {
        setTodos(
          todos.map((todo) => (todo.id === id ? (result.todo ?? todo) : todo)),
        );
        setEditingTodo(null);
        setError(null);
      } else {
        setError(result.error || "Failed to update todo");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo");
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!confirm("Are you sure you want to delete this todo?")) return;

    try {
      // Call server action to delete todo
      const result = await deleteTodo(id);

      if (result.success) {
        setTodos(todos.filter((todo) => todo.id !== id));
        setError(null);
      } else {
        setError(result.error || "Failed to delete todo");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo");
    }
  };

  const toggleComplete = async (todo: Todo) => {
    await handleUpdateTodo(todo.id, { completed: !todo.completed });
  };

  const saveEdit = async () => {
    if (!editingTodo) return;
    await handleUpdateTodo(editingTodo.id, {
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

  return (
    <div className="container">
      <header className="page-header">
        <h1 className="page-title">
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
          <form onSubmit={handleAddTodo} className="todo-form">
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Adding..." : "Add Todo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTodoTitle("");
                    setNewTodoDetails("");
                  }}
                  className="btn btn-secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {!showAddForm && (
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
                className={`todo-card ${todo.completed ? "completed" : ""}`}
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
                        className={`todo-title-btn ${todo.completed ? "completed" : ""}`}
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
                          onClick={() => handleDeleteTodo(todo.id)}
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
                          <div
                            className={`todo-description ${todo.completed ? "completed" : ""}`}
                          >
                            <p>{todo.details}</p>
                          </div>
                        )}

                        <div className="todo-meta">
                          <div className="meta-dates">
                            <span className="meta-item">
                              Created:{" "}
                              {new Date(todo.created_at).toLocaleString()}
                            </span>
                            <span className="meta-item">
                              Updated:{" "}
                              {new Date(todo.updated_at).toLocaleString()}
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
      )}
    </div>
  );
}
