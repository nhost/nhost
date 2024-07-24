import { ApplicationStatus } from '@/types/application';
import type {
  ConfigRunServicePort,
  DeploymentRowFragment,
} from '@/utils/__generated__/graphql';
import slugify from 'slugify';

export function getLastLiveDeployment(deployments?: DeploymentRowFragment[]) {
  if (!deployments) {
    return '';
  }

  return (
    deployments.find((deployment) => deployment.deploymentStatus === 'DEPLOYED')
      ?.id || ''
  );
}

export function slugifyString(s: string) {
  return slugify(s, { lower: true, strict: true });
}

export function capitalize(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export const checkHasuraConsoleStatus = async (subdomain: string) => {
  try {
    const res = await fetch(subdomain);
    return res.status === 200;
  } catch (e) {
    return false;
  }
};

export function isDevOrStaging(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENV === 'dev' ||
    process.env.NEXT_PUBLIC_ENV === 'staging'
  );
}

export type Environment = 'dev' | 'staging' | 'production';

/**
 * It returns the current environment based on the value of the `NEXT_PUBLIC_ENV`
 * environment variable.
 *
 * @returns The current environment
 */
export function getCurrentEnvironment(): Environment {
  return (process.env.NEXT_PUBLIC_ENV || 'dev') as Environment;
}

/**
 * Converts the state number of the application to its string equivalent.
 * @param appStatus The current state of the application.
 */
export function getApplicationStatusString(appStatus: ApplicationStatus) {
  return ApplicationStatus[appStatus];
}

/**
 * Gets relative date by application state of creation/unpausing events.
 * @param date The creation of the application, or when it was paused.
 */
export function getRelativeDateByApplicationState(date: string) {
  const renderedCurrentDate = new Date().getTime();
  const eventCreatedAt = new Date(date).getTime();
  const difference = renderedCurrentDate - eventCreatedAt;

  return Math.floor(difference / 1000);
}

/**
 * Creates a type where all properties and nested properties are marked as required deeply, including arrays.
 * @template T The type to make all properties required.
 */
export type DeepRequired<T> = {
  [K in keyof T]-?: T[K] extends object
    ? T[K] extends Array<infer U>
      ? Array<DeepRequired<U>>
      : DeepRequired<T[K]>
    : T[K];
};

/**
 * Recursively removes the property '__typename' from a JavaScript object and its nested objects and arrays.
 */
export const removeTypename = (obj: any) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeTypename(item));
  }

  const newObj = { ...obj };
  const keys = Object.keys(newObj);
  keys.forEach((key) => {
    if (key === '__typename') {
      delete newObj[key];
    } else {
      newObj[key] = removeTypename(newObj[key]);
    }
  });
  return newObj;
};

export const getRunServicePortURL = (
  subdomain: string,
  regionName: string,
  regionDomain: string,
  port: Partial<ConfigRunServicePort>,
) => {
  const { port: servicePort, ingresses } = port;

  const customDomain = ingresses?.[0]?.fqdn?.[0];

  if (customDomain) {
    return `https://${customDomain}`;
  }

  const servicePortNumber =
    Number(servicePort) > 0 ? Number(servicePort) : '[port]';
  return `https://${subdomain}-${servicePortNumber}.svc.${regionName}.${regionDomain}`;
};
