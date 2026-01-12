import { type JSX, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  useAddCommentMutation,
  useGetNinjaTurtlesWithCommentsQuery,
} from "../lib/graphql/__generated__/graphql";
import { useAuth } from "../lib/nhost/AuthProvider";
import "./Home.css";

export function helloThere(greeting: string) {
  if (greeting == "Hello") {
    return "There";
  }

  return "Hola";
}

export default function Home(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const { loading, error, data, refetch } =
    useGetNinjaTurtlesWithCommentsQuery();

  const [addComment] = useAddCommentMutation({
    onCompleted: () => {
      setCommentText("");
      setActiveCommentId(null);
      refetch();
    },
  });

  // If authentication is still loading, show a loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  // If not authenticated, redirect to signin page
  if (!isAuthenticated) {
    return <Navigate to="/signin" />;
  }

  const handleAddComment = (turtleId: string) => {
    if (!commentText.trim()) return;

    addComment({
      variables: {
        ninjaTurtleId: turtleId,
        comment: commentText,
      },
    });
  };

  if (loading)
    return (
      <div className="loading-container">
        <p>Loading ninja turtles...</p>
      </div>
    );
  if (error)
    return (
      <div className="alert alert-error">
        Error loading ninja turtles: {error.message}
      </div>
    );

  // Access the data using the correct field name from the GraphQL response
  const ninjaTurtles = data?.ninjaTurtles || [];
  if (!ninjaTurtles || ninjaTurtles.length === 0) {
    return (
      <div className="no-turtles-container">
        <p>No ninja turtles found. Please add some!</p>
      </div>
    );
  }

  // Set the active tab to the first turtle if there's no active tab and there are turtles
  if (activeTabId === null) {
    setActiveTabId(ninjaTurtles[0] ? ninjaTurtles[0].id : null);
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <div className="ninja-turtles-container">
      <h1 className="ninja-turtles-title text-3xl font-bold mb-6">
        Teenage Mutant Ninja Turtles
      </h1>

      {/* Tabs navigation */}
      <div className="turtle-tabs">
        {ninjaTurtles.map((turtle) => (
          <button
            type="button"
            key={turtle.id}
            className={`turtle-tab ${activeTabId === turtle.id ? "active" : ""}`}
            onClick={() => setActiveTabId(turtle.id)}
          >
            {turtle.name}
          </button>
        ))}
      </div>

      {/* Display active turtle */}
      {ninjaTurtles
        .filter((turtle) => turtle.id === activeTabId)
        .map((turtle) => (
          <div key={turtle.id} className="turtle-card glass-card p-6">
            <div className="turtle-header">
              <h2 className="turtle-name text-2xl font-semibold">
                {turtle.name}
              </h2>
            </div>

            <p className="turtle-description">{turtle.description}</p>

            <div className="turtle-date">
              Added on {formatDate(turtle.createdAt || turtle.createdAt)}
            </div>

            <div className="comments-section">
              <h3 className="comments-title">
                Comments ({turtle.comments.length})
              </h3>

              {turtle.comments.map((comment) => (
                <div key={comment.id} className="comment-card">
                  <p className="comment-text">{comment.comment}</p>
                  <div className="comment-meta">
                    <div className="comment-avatar">
                      {(comment.user?.displayName || comment.user?.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <p>
                      {comment.user?.displayName ||
                        comment.user?.email ||
                        "Anonymous"}{" "}
                      - {formatDate(comment.createdAt || comment.createdAt)}
                    </p>
                  </div>
                </div>
              ))}

              {activeCommentId === turtle.id ? (
                <div className="comment-form">
                  <textarea
                    className="comment-textarea"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add your comment..."
                    rows={3}
                  />
                  <div className="comment-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCommentId(null);
                        setCommentText("");
                      }}
                      className="btn cancel-button"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddComment(turtle.id)}
                      className="btn submit-button"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveCommentId(turtle.id)}
                  className="add-comment-button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    role="img"
                    aria-label="Add comment"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add a comment
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
