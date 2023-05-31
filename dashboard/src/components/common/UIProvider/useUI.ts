import { useContext } from 'react';
import UIContext from './UIContext';

export default function useUI() {
  const context = useContext(UIContext);

  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }

  return context;
}
