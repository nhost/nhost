import { useEffect, useState } from 'react';

export default function useHostName() {
  const [hostName, setHostName] = useState('');

  useEffect(() => {
    const { port, hostname, protocol } = window.location;
    setHostName(`${protocol}//${hostname}:${port}`);
  }, []);

  return hostName;
}
