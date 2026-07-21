export default async function executeWithLoadingState(
  operation: () => Promise<unknown>,
  setLoading: (loading: boolean) => void,
): Promise<void> {
  setLoading(true);

  try {
    await operation();
  } finally {
    setLoading(false);
  }
}
