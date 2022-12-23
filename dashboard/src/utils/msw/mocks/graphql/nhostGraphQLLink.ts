import { graphql } from 'msw';

const nhostGraphQLLink = graphql.link('http://localhost:1337/v1/graphql');

export default nhostGraphQLLink;
