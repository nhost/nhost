import nhostGraphQLLink from './nhostGraphQLLink';

export default nhostGraphQLLink.mutation('UpdateConfig', (req, res, ctx) =>
  res(
    ctx.data({
      updateConfig: {
        id: 'ConfigConfig',
      },
    }),
  ),
);
