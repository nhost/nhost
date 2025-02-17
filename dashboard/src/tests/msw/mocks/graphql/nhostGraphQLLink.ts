import { graphql } from 'msw';

const nhostGraphQLLink = graphql.link(
  'https://local.graphql.local.nhost.run/v1',
);

export default nhostGraphQLLink;
