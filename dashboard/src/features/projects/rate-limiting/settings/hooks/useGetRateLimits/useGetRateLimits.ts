import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetRateLimitConfigQuery } from '@/utils/__generated__/graphql';
import { DEFAULT_RATE_LIMITS } from 'features/projects/rate-limiting/settings/utils/constants';
import { parseIntervalNameUnit } from 'features/projects/rate-limiting/settings/utils/parseIntervalNameUnit';

export default function useGetRateLimits() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, loading } = useGetRateLimitConfigQuery({
    variables: {
      appId: currentProject?.id,
      resolve: true,
    },
    skip: !currentProject,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const authRateLimit = data?.config?.auth?.rateLimit;
  const hasuraRateLimit = data?.config?.hasura?.rateLimit;
  const storageRateLimit = data?.config?.storage?.rateLimit;
  const functionsRateLimit = data?.config?.functions?.rateLimit;

  const { bruteForce, emails, global, signups, sms } = authRateLimit || {};
  const { limit: bruteForceLimit, interval: bruteForceIntervalStr } =
    bruteForce || {};
  const { interval: bruteForceInterval, intervalUnit: bruteForceIntervalUnit } =
    parseIntervalNameUnit(bruteForceIntervalStr);

  const { limit: emailsLimit, interval: emailsIntervalStr } = emails || {};
  const { interval: emailsInterval, intervalUnit: emailsIntervalUnit } =
    parseIntervalNameUnit(emailsIntervalStr);

  const { limit: globalLimit, interval: globalIntervalStr } = global || {};
  const { interval: globalInterval, intervalUnit: globalIntervalUnit } =
    parseIntervalNameUnit(globalIntervalStr);

  const { limit: signupsLimit, interval: signupsIntervalStr } = signups || {};
  const { interval: signupsInterval, intervalUnit: signupsIntervalUnit } =
    parseIntervalNameUnit(signupsIntervalStr);

  const { limit: smsLimit, interval: smsIntervalStr } = sms || {};
  const { interval: smsInterval, intervalUnit: smsIntervalUnit } =
    parseIntervalNameUnit(smsIntervalStr);

  const { limit: hasuraLimit, interval: hasuraIntervalStr } =
    hasuraRateLimit || {};
  const { interval: hasuraInterval, intervalUnit: hasuraIntervalUnit } =
    parseIntervalNameUnit(hasuraIntervalStr);

  const { limit: storageLimit, interval: storageIntervalStr } =
    storageRateLimit || {};
  const { interval: storageInterval, intervalUnit: storageIntervalUnit } =
    parseIntervalNameUnit(storageIntervalStr);

  const { limit: functionsLimit, interval: functionsIntervalStr } =
    functionsRateLimit || {};
  const { interval: functionsInterval, intervalUnit: functionsIntervalUnit } =
    parseIntervalNameUnit(functionsIntervalStr);

  return {
    authRateLimit: {
      enabled: !!authRateLimit,
      bruteForce: {
        limit: bruteForceLimit || DEFAULT_RATE_LIMITS.limit,
        interval: bruteForceInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit:
          bruteForceIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
      emails: {
        limit: emailsLimit || DEFAULT_RATE_LIMITS.limit,
        interval: emailsInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: emailsIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
      global: {
        limit: globalLimit || DEFAULT_RATE_LIMITS.limit,
        interval: globalInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: globalIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
      signups: {
        limit: signupsLimit || DEFAULT_RATE_LIMITS.limit,
        interval: signupsInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: signupsIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
      sms: {
        limit: smsLimit || DEFAULT_RATE_LIMITS.limit,
        interval: smsInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: smsIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
    },
    hasuraDefaultValues: {
      enabled: !!hasuraRateLimit,
      rateLimit: {
        limit: hasuraLimit || DEFAULT_RATE_LIMITS.limit,
        interval: hasuraInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: hasuraIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
    },
    storageDefaultValues: {
      enabled: !!storageRateLimit,
      rateLimit: {
        limit: storageLimit || DEFAULT_RATE_LIMITS.limit,
        interval: storageInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: storageIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
    },
    functionsDefaultValues: {
      enabled: !!functionsRateLimit,
      rateLimit: {
        limit: functionsLimit || DEFAULT_RATE_LIMITS.limit,
        interval: functionsInterval || DEFAULT_RATE_LIMITS.interval,
        intervalUnit: functionsIntervalUnit || DEFAULT_RATE_LIMITS.intervalUnit,
      },
    },
    loading,
  };
}
