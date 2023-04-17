import { mockApplication, mockWorkspace } from '@/tests/mocks';
import nhostGraphQLLink from './nhostGraphQLLink';

/**
 * Use this handler to simulate a query that returns only the Pro plan.
 */
export const getProPlanOnlyQuery = nhostGraphQLLink.query(
  'GetPlans',
  (_req, res, ctx) =>
    res(
      ctx.data({
        plans: [
          {
            __typename: 'plans',
            id: 'dc5e805e-1bef-4d43-809e-9fdf865e211a',
            name: 'Pro',
            price: 25,
            isFree: false,
          },
        ],
      }),
    ),
);

/**
 * Use this handler to simulate a query that returns all the available plans.
 */
export const getAllPlansQuery = nhostGraphQLLink.query(
  'GetPlans',
  (_req, res, ctx) =>
    res(
      ctx.data({
        plans: [
          {
            __typename: 'plans',
            id: '00000000-0000-0000-0000-000000000000',
            name: 'Starter',
            price: 0,
            isFree: true,
          },
          {
            __typename: 'plans',
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Pro',
            price: 25,
            isFree: false,
          },
        ],
      }),
    ),
);

/**
 * Use this handler to simulate a query that returns a workspace and a project.
 * Useful if you want to mock the currently selected project.
 */
export const getWorkspaceAndProjectQuery = nhostGraphQLLink.query(
  'GetWorkspaceAndProject',
  (_req, res, ctx) =>
    res(
      ctx.data({
        workspaces: [mockWorkspace],
        projects: [mockApplication],
      }),
    ),
);
