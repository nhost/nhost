import Link from 'next/link';

export default async function VerifyError({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const message = params?.message || 'Unknown verification error';

  // Filter out the message to show other URL parameters
  const urlParams = Object.entries(params).filter(([key]) => key !== 'message');

  return (
    <div>
      <h1>Email Verification</h1>

      <div className="page-center">
        <p className="verification-status error">Verification failed</p>
        <p className="margin-bottom">{message}</p>

        {urlParams.length > 0 && (
          <div className="debug-panel">
            <p className="debug-title">URL Parameters:</p>
            {urlParams.map(([key, value]) => (
              <div key={key} className="debug-item">
                <span className="debug-key">{key}:</span>{' '}
                <span className="debug-value">{value}</span>
              </div>
            ))}
          </div>
        )}

        <Link href="/signin" className="auth-button secondary">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
