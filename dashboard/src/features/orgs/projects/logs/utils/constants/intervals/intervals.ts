export type LogsCustomInterval = {
  /**
   * Label to be displayed in the UI.
   */
  label: string;
  /**
   * Value in minutes to decrease from the fetching query.
   */
  minutesToDecreaseFromCurrentDate: number;
};

export const LOGS_AVAILABLE_INTERVALS: LogsCustomInterval[] = [
  {
    label: '5 min',
    minutesToDecreaseFromCurrentDate: 5,
  },
  {
    label: '15 min',
    minutesToDecreaseFromCurrentDate: 15,
  },
  {
    label: '30 min',
    minutesToDecreaseFromCurrentDate: 30,
  },
  {
    label: '60 min',
    minutesToDecreaseFromCurrentDate: 60,
  },
  {
    label: '12 hours',
    minutesToDecreaseFromCurrentDate: 720,
  },
  {
    label: '24 hours',
    minutesToDecreaseFromCurrentDate: 1440,
  },
];
