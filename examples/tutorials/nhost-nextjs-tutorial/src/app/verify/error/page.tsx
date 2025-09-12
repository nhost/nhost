import Link from "next/link";

export default async function VerifyError({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const message = params?.message || "Unknown verification error";

  // Filter out the message to show other URL parameters
  const urlParams = Object.entries(params).filter(([key]) => key !== "message");

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Email Verification</h1>

      <div className="glass-card w-full p-8 mb-6">
        <div className="text-center">
          <p className="verification-status error mb-4">
            Verification Failed
          </p>

          <p className="mb-6">{message}</p>

          {urlParams.length > 0 && (
            <div className="debug-panel mb-6 text-left">
              <p className="debug-title font-semibold mb-2">
                URL Parameters:
              </p>
              {urlParams.map(([key, value]) => (
                <div key={key} className="debug-item mb-1">
                  <span className="debug-key font-mono">
                    {key}:
                  </span>{" "}
                  <span className="debug-value">{value}</span>
                </div>
              ))}
            </div>
          )}

          <Link href="/signin" className="btn btn-primary">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
