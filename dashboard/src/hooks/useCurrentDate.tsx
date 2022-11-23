export type UseCurrentDateReturn = {
  /**
   * The current date in miliseconds.
   */
  currentDate: number;
};

export function useCurrentDate(): UseCurrentDateReturn {
  const currentDate = new Date().getTime();
  return { currentDate };
}
