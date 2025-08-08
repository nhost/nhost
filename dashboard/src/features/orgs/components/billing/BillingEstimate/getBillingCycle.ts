export const getBillingCycleInfo = () => {
  const now = new Date();
  const year = now.getFullYear();

  const startOfMonth = new Date(year, now.getMonth(), 1);
  const endOfMonth = new Date(year, now.getMonth() + 1, 0);

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  const billingCycleStart = startOfMonth.toLocaleDateString('en-US', options);
  const billingCycleEnd = endOfMonth.toLocaleDateString('en-US', options);

  const totalDays =
    (endOfMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const daysPassed =
    (now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24) + 1;

  const progress = (daysPassed / totalDays) * 100;
  const daysLeft = Math.max(Math.ceil(totalDays - daysPassed), 0);

  return {
    billingCycleStart,
    billingCycleEnd,
    billingCycleRange: `${billingCycleStart} - ${billingCycleEnd}`,
    progress: Math.min(Math.max(progress, 0), 100), // Ensure the value is between 0 and 100
    daysLeft,
  };
};
