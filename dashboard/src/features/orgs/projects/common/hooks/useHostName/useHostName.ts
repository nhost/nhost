import { useEffect, useState } from 'react';

export default function useHostName() {
  const [hostName, setHostName] = useState('');

  useEffect(() => {
    const { port, hostname, protocol } = window.location;
    const portSuffix = port ? `:${port}` : '';
    setHostName(`${protocol}//${hostname}${portSuffix}`);
  }, []);

  return hostName;
}
