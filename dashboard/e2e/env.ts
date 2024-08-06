import slugify from 'slugify';

/**
 * URL of the dashboard to test against.
 */
export const TEST_DASHBOARD_URL = process.env.NHOST_TEST_DASHBOARD_URL;

/**
 * Name of the workspace to test against.
 */
export const TEST_WORKSPACE_NAME = process.env.NHOST_TEST_WORKSPACE_NAME;

/**
 * Slugified name of the workspace to test against.
 */
export const TEST_WORKSPACE_SLUG = slugify(TEST_WORKSPACE_NAME, {
  lower: true,
  strict: true,
});

/**
 * Name of the project to test against.
 */
export const TEST_PROJECT_NAME = process.env.NHOST_TEST_PROJECT_NAME;

/**
 * Name of the pro test project to test against.
 */
export const PRO_TEST_PROJECT_NAME = process.env.NHOST_PRO_TEST_PROJECT_NAME;

/**
 * Slugified name of the project to test against.
 */
export const TEST_PROJECT_SLUG = slugify(TEST_PROJECT_NAME, {
  lower: true,
  strict: true,
});

/**
 * Slugified name of the pro project to test against.
 */
export const PRO_TEST_PROJECT_SLUG = slugify(PRO_TEST_PROJECT_NAME, {
  lower: true,
  strict: true,
});

/**
 * Hasura admin secret of the test project to use.
 */
export const TEST_PROJECT_ADMIN_SECRET =
  process.env.NHOST_TEST_PROJECT_ADMIN_SECRET;

/**
 * Email of the test account to use.
 */
export const TEST_USER_EMAIL = process.env.NHOST_TEST_USER_EMAIL;

/**
 * Password of the test account to use.
 */
export const TEST_USER_PASSWORD = process.env.NHOST_TEST_USER_PASSWORD;
