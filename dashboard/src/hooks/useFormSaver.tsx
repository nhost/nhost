import { useState } from 'react';
import { useSubmitState } from './useSubmitState';

export function useFormSaver() {
  const [showFormSaver, setShowFormSaver] = useState(false);
  const { submitState, setSubmitState } = useSubmitState();

  return { showFormSaver, setShowFormSaver, submitState, setSubmitState };
}

export default useFormSaver;
