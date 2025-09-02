"use client";

import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { useState } from "react";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { nhost } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset states
    setError("");
    setSuccess(false);

    // Validate passwords
    if (newPassword.length < 3) {
      setError("Password must be at least 3 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      await nhost.auth.changeUserPassword({
        newPassword,
      });

      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`Failed to change password: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card p-8 mb-6">
      <h3 className="text-xl mb-4">Change Password</h3>

      {success && (
        <div className="alert alert-success mb-4">
          Password changed successfully!
        </div>
      )}

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="new-password"
            className="block text-sm font-medium mb-1"
          >
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minLength={3}
            disabled={isLoading}
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full"
        >
          {isLoading ? "Updating..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
