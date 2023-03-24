import { graphql } from 'msw';

const nhostGraphQLLink = graphql.link('https://local.graphql.nhost.run/v1');

export default nhostGraphQLLink;
