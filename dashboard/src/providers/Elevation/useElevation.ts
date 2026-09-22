import { useContext } from 'react';
import { ElevationContext } from './ElevationContext';

export function useElevation() {
  const context = useContext(ElevationContext);

  if (!context) {
    throw new Error('useElevation must be used within an ElevationProvider');
  }

  return context;
}
