import type { JSX } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';

export default function Profile(): JSX.Element {
  const { user, session } = useAuth();

  // ProtectedRoute component now handles authentication check
  // We can just focus on the component logic here

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl mb-6 gradient-text">Your Profile</h1>

      <div className="glass-card p-8 mb-6">
        <div className="space-y-5">
          <div className="profile-item">
            <strong>Display Name:</strong>
            <span className="ml-2">{user?.displayName || 'Not set'}</span>
          </div>

          <div className="profile-item">
            <strong>Email:</strong>
            <span className="ml-2">{user?.email || 'Not available'}</span>
          </div>

          <div className="profile-item">
            <strong>User ID:</strong>
            <span
              className="ml-2"
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: '0.875rem',
              }}
            >
              {user?.id || 'Not available'}
            </span>
          </div>

          <div className="profile-item">
            <strong>Roles:</strong>
            <span className="ml-2">{user?.roles?.join(', ') || 'None'}</span>
          </div>

          <div className="profile-item">
            <strong>Email Verified:</strong>
            <span className="ml-2">{user?.emailVerified ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-8 mb-6">
        <h3 className="text-xl mb-4">Session Information</h3>
        <pre>
          {JSON.stringify(
            {
              refreshTokenId: session?.refreshTokenId,
              accessTokenExpiresIn: session?.accessTokenExpiresIn,
            },
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  );
}
