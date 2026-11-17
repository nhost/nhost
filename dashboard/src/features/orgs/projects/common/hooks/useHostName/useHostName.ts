import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// Returns the dashboard's base URL, including Next.js `basePath` so links
// built from it work when the dashboard is served under a sub-path.
export default function useHostName() {
  const { basePath } = useRouter();
  const [hostName, setHostName] = useState('');

  useEffect(() => {
    const { port, hostname, protocol } = window.location;
    const portSuffix = port ? `:${port}` : '';
    setHostName(`${protocol}//${hostname}${portSuffix}${basePath}`);
  }, [basePath]);

  return hostName;
}
