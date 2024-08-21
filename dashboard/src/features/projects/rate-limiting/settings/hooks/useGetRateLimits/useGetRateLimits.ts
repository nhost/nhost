import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetRateLimitConfigQuery } from '@/utils/__generated__/graphql';

function parseIntervalNameUnit(interval: string) {
  if (!interval) {
    return {};
  }
  const regex = /^(\d+)([a-zA-Z])$/;
  const match = interval.match(regex);

  if (!match) {
    return {};
  }

  const [, intervalValue, intervalUnit] = match;

  return {
    interval: parseInt(intervalValue, 10),
    intervalUnit,
  };
}

export default function useGetRateLimits() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, loading } = useGetRateLimitConfigQuery({
    variables: {
      appId: currentProject?.id,
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
        limit: bruteForceLimit || 1000,
        interval: bruteForceInterval || 5,
        intervalUnit: bruteForceIntervalUnit || 'm',
      },
      emails: {
        limit: emailsLimit || 1000,
        interval: emailsInterval || 5,
        intervalUnit: emailsIntervalUnit || 'm',
      },
      global: {
        limit: globalLimit || 1000,
        interval: globalInterval || 5,
        intervalUnit: globalIntervalUnit || 'm',
      },
      signups: {
        limit: signupsLimit || 1000,
        interval: signupsInterval || 5,
        intervalUnit: signupsIntervalUnit || 'm',
      },
      sms: {
        limit: smsLimit || 1000,
        interval: smsInterval || 5,
        intervalUnit: smsIntervalUnit || 'm',
      },
    },
    hasuraRateLimit: {
      enabled: !!hasuraRateLimit,
      limit: hasuraLimit || 1000,
      interval: hasuraInterval || 5,
      intervalUnit: hasuraIntervalUnit || 'm',
    },
    storageRateLimit: {
      enabled: !!storageRateLimit,
      limit: storageLimit || 1000,
      interval: storageInterval || 5,
      intervalUnit: storageIntervalUnit || 'm',
    },
    functionsRateLimit: {
      enabled: !!functionsRateLimit,
      limit: functionsLimit || 1000,
      interval: functionsInterval || 5,
      intervalUnit: functionsIntervalUnit || 'm',
    },
    loading,
  };
}
