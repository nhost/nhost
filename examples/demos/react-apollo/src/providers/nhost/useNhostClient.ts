import { useContext } from 'react';
import { NhostContext } from './NhostContext';

export function useNhostClient() {
  const context = useContext(NhostContext);

  if (!context) {
    throw new Error('useNhostClient must be used within an NhostProvider');
  }

  return context;
}
