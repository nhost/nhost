interface ErrorPageProps {
  searchParams: Promise<{
    message?: string;
    [key: string]: string | undefined;
  }>;
}

export default async function VerificationError({
  searchParams,
}: ErrorPageProps) {
  const params = await searchParams;
  const errorMessage = params?.message || "Verification failed";

  // Extract all URL parameters to display
  const urlParams = { ...params };
  delete urlParams.message; // Remove message from parameters display since we're already showing it

  const hasUrlParams = Object.keys(urlParams).length > 0;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-6">Verification Failed</h2>
        <p className="text-red-500 mb-4">{errorMessage}</p>

        {hasUrlParams && (
          <div className="mb-4 p-4 bg-gray-100 rounded-md text-left overflow-auto max-h-48">
            <p className="font-semibold mb-2">URL Parameters:</p>
            {Object.entries(urlParams).map(([key, value]) => (
              <div key={key} className="mb-1">
                <span className="font-mono text-blue-600">{key}:</span>{" "}
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <a href="/signin" className="btn btn-primary">
            Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
