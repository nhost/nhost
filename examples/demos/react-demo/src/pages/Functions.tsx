import { type JSX, useState } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';

interface FunctionResult {
  status: number;
  body: unknown;
  duration: number;
}

interface FunctionDef {
  id: string;
  name: string;
  description: string;
  path: string;
  method: string;
  needsAuth: boolean;
  body?: Record<string, unknown>;
}

const FUNCTIONS: FunctionDef[] = [
  {
    id: 'echo',
    name: 'Echo',
    description:
      'Returns request metadata: headers, query params, method, Node version, and invocation ID.',
    path: '/echo?demo=true',
    method: 'GET',
    needsAuth: false,
  },
  {
    id: 'error',
    name: 'Handled Error',
    description:
      'Throws an error inside a try/catch and returns a structured 500 response.',
    path: '/error',
    method: 'GET',
    needsAuth: false,
  },
  {
    id: 'crash',
    name: 'Unhandled Error (Crash)',
    description:
      'Throws an unhandled error — the function crashes and returns a generic 500.',
    path: '/crash',
    method: 'GET',
    needsAuth: false,
  },
  {
    id: 'jwt-verify',
    name: 'JWT Verification',
    description:
      "Verifies the caller's JWT using the JWKS endpoint and returns the decoded token.",
    path: '/jwt-verify',
    method: 'GET',
    needsAuth: true,
  },
  {
    id: 'custom-jwt',
    name: 'Custom JWT',
    description:
      'Generates a custom JWT for a given user ID. Requires admin secret or an admin/operator JWT.',
    path: '/custom-jwt',
    method: 'POST',
    needsAuth: true,
    body: {
      userId: 'FFAB5354-C5EB-42C1-8BC3-AD21D2297883',
      defaultRole: 'user',
      allowedRoles: ['user', 'me'],
    },
  },
  {
    id: 'cors',
    name: 'CORS (Manual)',
    description:
      'A function with manual CORS headers. Returns the request origin and method. Handles OPTIONS preflight.',
    path: '/cors',
    method: 'GET',
    needsAuth: false,
  },
  {
    id: 'cors-middleware',
    name: 'CORS (Middleware)',
    description:
      'A function using the cors npm package for automatic CORS handling.',
    path: '/cors-middleware',
    method: 'GET',
    needsAuth: false,
  },
  {
    id: 'sdk-todos',
    name: 'SDK: Todos (as caller)',
    description:
      'Uses the Nhost SDK to query todos on behalf of the authenticated user by forwarding the Authorization header.',
    path: '/sdk-todos',
    method: 'GET',
    needsAuth: true,
  },
  {
    id: 'sdk-admin',
    name: 'SDK: Users (as admin)',
    description:
      'Uses the Nhost SDK with admin secret to list all users. No caller auth required.',
    path: '/sdk-admin',
    method: 'GET',
    needsAuth: false,
  },
];

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function Functions(): JSX.Element {
  const { nhost } = useAuth();
  const [results, setResults] = useState<Record<string, FunctionResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const callFunction = async (fn: FunctionDef): Promise<void> => {
    setLoading((prev) => ({ ...prev, [fn.id]: true }));
    setResults((prev) => {
      const next = { ...prev };
      delete next[fn.id];
      return next;
    });

    const start = performance.now();

    try {
      let response: { body: unknown; status: number };

      if (fn.method === 'POST' && fn.body) {
        response = await nhost.functions.post(fn.path, fn.body);
      } else {
        response = await nhost.functions.fetch(fn.path, { method: fn.method });
      }

      const duration = Math.round(performance.now() - start);
      setResults((prev) => ({
        ...prev,
        [fn.id]: { status: response.status, body: response.body, duration },
      }));
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - start);
      const fetchErr = err as {
        status?: number;
        body?: unknown;
        message?: string;
      };
      setResults((prev) => ({
        ...prev,
        [fn.id]: {
          status: fetchErr.status ?? 0,
          body: fetchErr.body ?? { error: fetchErr.message ?? 'Network error' },
          duration,
        },
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [fn.id]: false }));
    }
  };

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl mb-6 gradient-text">Functions</h1>

      <div className="glass-card p-8 mb-6">
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Test the serverless functions deployed in the backend. Each button
          calls the corresponding function endpoint via the Nhost SDK and
          displays the response.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Base URL:{' '}
          <code style={{ color: 'var(--primary)' }}>
            {nhost.functions.baseURL}
          </code>
        </p>
      </div>

      {FUNCTIONS.map((fn) => {
        const result = results[fn.id];
        const isLoading = loading[fn.id];

        return (
          <div key={fn.id} className="glass-card p-8 mb-6">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <h2 className="text-2xl" style={{ marginBottom: '0.25rem' }}>
                  {fn.name}
                </h2>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <code>
                    {fn.method} {fn.path}
                  </code>
                  {fn.needsAuth && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        color: 'var(--warning, #f59e0b)',
                        fontSize: '0.8rem',
                      }}
                    >
                      🔒 Auth required
                    </span>
                  )}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {fn.description}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => callFunction(fn)}
                disabled={isLoading}
                style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
              >
                {isLoading ? 'Calling...' : 'Call'}
              </button>
            </div>

            {fn.body && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  Request body:
                </p>
                <pre
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary, rgba(0,0,0,0.2))',
                    overflow: 'auto',
                    margin: 0,
                  }}
                >
                  {formatJson(fn.body)}
                </pre>
              </div>
            )}

            {result && (
              <div style={{ marginTop: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <span
                    style={{
                      color:
                        result.status >= 200 && result.status < 300
                          ? 'var(--success, #22c55e)'
                          : 'var(--error, #ef4444)',
                    }}
                  >
                    Status: {result.status || 'Network Error'}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {result.duration}ms
                  </span>
                </div>
                <pre
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary, rgba(0,0,0,0.2))',
                    overflow: 'auto',
                    maxHeight: '300px',
                    margin: 0,
                  }}
                >
                  {formatJson(result.body)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
