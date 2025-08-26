import { test, expect } from "@jest/globals";
import { createClient } from "@nhost/nhost-js";
import { type GraphQLResponse } from "@nhost/nhost-js/graphql";
import { FetchError } from "@nhost/nhost-js/fetch";
import gql from "graphql-tag";

const subdomain = "local";
const region = "local";

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
test("request", async () => {
  const nhost = createClient({
    subdomain,
    region,
  });

  const resp = await nhost.graphql.request({
    query: `query GetMovies {
          movies {
            id
            title
            director
            genre
          }
        }`,
  });

  console.log(resp.body.data?.movies);
  // [
  //   {
  //     id: '3d67a6d0-bfb5-444a-9152-aea543ebd171',
  //     title: 'The Matrix',
  //     director: 'Lana Wachowski, Lilly Wachowski',
  //     genre: 'Sci-Fi'
  //   },
  //   {
  //     id: '90f374db-16c1-4db5-ba55-643bf38953d3',
  //     title: 'Inception',
  //     director: 'Christopher Nolan',
  //     genre: 'Sci-Fi'
  //   },
  //   {
  //     id: '900fa76c-fc79-470d-817b-4dc4412a79e8',
  //     title: 'The Godfather',
  //     director: 'Francis Ford Coppola',
  //     genre: 'Crime'
  //   },
  //   {
  //     id: '2867cadd-2904-482f-b43c-f77ce8412a93',
  //     title: 'Pulp Fiction',
  //     director: 'Quentin Tarantino',
  //     genre: 'Crime'
  //   },
  //   {
  //     id: '8c06c70a-872e-49a7-8770-29355dcd05c6',
  //     title: 'The Dark Knight',
  //     director: 'Christopher Nolan',
  //     genre: 'Action'
  //   }
  // ]

  expect(resp.body.data).toBeDefined();
  expect(resp.body.data?.movies).toStrictEqual([
    {
      director: "Lana Wachowski, Lilly Wachowski",
      genre: "Sci-Fi",
      id: "3d67a6d0-bfb5-444a-9152-aea543ebd171",
      title: "The Matrix",
    },
    {
      director: "Christopher Nolan",
      genre: "Sci-Fi",
      id: "90f374db-16c1-4db5-ba55-643bf38953d3",
      title: "Inception",
    },
    {
      director: "Francis Ford Coppola",
      genre: "Crime",
      id: "900fa76c-fc79-470d-817b-4dc4412a79e8",
      title: "The Godfather",
    },
    {
      director: "Quentin Tarantino",
      genre: "Crime",
      id: "2867cadd-2904-482f-b43c-f77ce8412a93",
      title: "Pulp Fiction",
    },
    {
      director: "Christopher Nolan",
      genre: "Action",
      id: "8c06c70a-872e-49a7-8770-29355dcd05c6",
      title: "The Dark Knight",
    },
  ]);
});
/* eslint-enable @typescript-eslint/no-unsafe-member-access */

test("request typed", async () => {
  const nhost = createClient({
    subdomain,
    region,
  });

  // This is optional but allows you to type the response
  // Tools like Apollo Client or The Guild's GraphQL Code Generator
  // can generate these document nodes for you.
  interface Movies {
    movies: {
      id: string;
      title: string;
      director: string;
      genre: string;
    }[];
  }

  const resp = await nhost.graphql.request<Movies>({
    query: `query GetMovies {
          movies {
            id
            title
            director
            genre
          }
        }`,
  });

  console.log(resp.body.data?.movies);
  // [
  //   {
  //     id: '3d67a6d0-bfb5-444a-9152-aea543ebd171',
  //     title: 'The Matrix',
  //     director: 'Lana Wachowski, Lilly Wachowski',
  //     genre: 'Sci-Fi'
  //   },
  //   {
  //     id: '90f374db-16c1-4db5-ba55-643bf38953d3',
  //     title: 'Inception',
  //     director: 'Christopher Nolan',
  //     genre: 'Sci-Fi'
  //   },
  //   {
  //     id: '900fa76c-fc79-470d-817b-4dc4412a79e8',
  //     title: 'The Godfather',
  //     director: 'Francis Ford Coppola',
  //     genre: 'Crime'
  //   },
  //   {
  //     id: '2867cadd-2904-482f-b43c-f77ce8412a93',
  //     title: 'Pulp Fiction',
  //     director: 'Quentin Tarantino',
  //     genre: 'Crime'
  //   },
  //   {
  //     id: '8c06c70a-872e-49a7-8770-29355dcd05c6',
  //     title: 'The Dark Knight',
  //     director: 'Christopher Nolan',
  //     genre: 'Action'
  //   }
  // ]

  expect(resp.body.data).toBeDefined();
  expect(resp.body.data?.movies).toStrictEqual([
    {
      director: "Lana Wachowski, Lilly Wachowski",
      genre: "Sci-Fi",
      id: "3d67a6d0-bfb5-444a-9152-aea543ebd171",
      title: "The Matrix",
    },
    {
      director: "Christopher Nolan",
      genre: "Sci-Fi",
      id: "90f374db-16c1-4db5-ba55-643bf38953d3",
      title: "Inception",
    },
    {
      director: "Francis Ford Coppola",
      genre: "Crime",
      id: "900fa76c-fc79-470d-817b-4dc4412a79e8",
      title: "The Godfather",
    },
    {
      director: "Quentin Tarantino",
      genre: "Crime",
      id: "2867cadd-2904-482f-b43c-f77ce8412a93",
      title: "Pulp Fiction",
    },
    {
      director: "Christopher Nolan",
      genre: "Action",
      id: "8c06c70a-872e-49a7-8770-29355dcd05c6",
      title: "The Dark Knight",
    },
  ]);
});

test("request with qql", async () => {
  const nhost = createClient({
    subdomain,
    region,
  });

  // This is optional but allows you to type the response
  // Tools like Apollo Client or The Guild's GraphQL Code Generator
  // can generate these document nodes for you.
  interface Movies {
    movies: {
      id: string;
      title: string;
      director: string;
      genre: string;
    }[];
  }

  const getMoviesQuery = gql`
    query GetMovies {
      movies {
        id
        title
        director
        genre
      }
    }
  `;

  const resp = await nhost.graphql.request<Movies>(getMoviesQuery);
  console.log(resp.body.data?.movies);
  // [
  //   {
  //     id: '3d67a6d0-bfb5-444a-9152-aea543ebd171',
  //     title: 'The Matrix',
  //     director: 'Lana Wachowski, Lilly Wachowski',
  //     genre: 'Sci-Fi'
  //   },
  //   {
  //     id: '90f374db-16c1-4db5-ba55-643bf38953d3',
  //     title: 'Inception',
  //     director: 'Christopher Nolan',
  //     genre: 'Sci-Fi'
  //   },
  //   {
  //     id: '900fa76c-fc79-470d-817b-4dc4412a79e8',
  //     title: 'The Godfather',
  //     director: 'Francis Ford Coppola',
  //     genre: 'Crime'
  //   },
  //   {
  //     id: '2867cadd-2904-482f-b43c-f77ce8412a93',
  //     title: 'Pulp Fiction',
  //     director: 'Quentin Tarantino',
  //     genre: 'Crime'
  //   },
  //   {
  //     id: '8c06c70a-872e-49a7-8770-29355dcd05c6',
  //     title: 'The Dark Knight',
  //     director: 'Christopher Nolan',
  //     genre: 'Action'
  //   }
  // ]

  expect(resp.body.data).toBeDefined();
  expect(resp.body.data?.movies).toStrictEqual([
    {
      director: "Lana Wachowski, Lilly Wachowski",
      genre: "Sci-Fi",
      id: "3d67a6d0-bfb5-444a-9152-aea543ebd171",
      title: "The Matrix",
    },
    {
      director: "Christopher Nolan",
      genre: "Sci-Fi",
      id: "90f374db-16c1-4db5-ba55-643bf38953d3",
      title: "Inception",
    },
    {
      director: "Francis Ford Coppola",
      genre: "Crime",
      id: "900fa76c-fc79-470d-817b-4dc4412a79e8",
      title: "The Godfather",
    },
    {
      director: "Quentin Tarantino",
      genre: "Crime",
      id: "2867cadd-2904-482f-b43c-f77ce8412a93",
      title: "Pulp Fiction",
    },
    {
      director: "Christopher Nolan",
      genre: "Action",
      id: "8c06c70a-872e-49a7-8770-29355dcd05c6",
      title: "The Dark Knight",
    },
  ]);
});

test("error handling for graphql", async () => {
  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.graphql.request({
      query: `
        query GetRestrictedObject {
          restrictedObject {
            restrictedField
          }
        }
      `,
    });

    expect(true).toBe(false); // This should not be reached
  } catch (error) {
    if (!(error instanceof FetchError)) {
      throw error; // Re-throw if it's not a FetchError
    }

    const resp = error as FetchError<GraphQLResponse>;
    console.log("Error:", JSON.stringify(resp.body, null, 2));
    // Error: {
    //   "body": {
    //     "errors": [
    //       {
    //         "message": "field 'restrictedObject' not found in type: 'query_root'",
    //         "extensions": {
    //           "path": "$.selectionSet.restrictedObject",
    //           "code": "validation-failed"
    //         }
    //       }
    //     ]
    //   },
    //   "status": 200,
    //   "headers": {}
    // }

    // error handling...

    expect(resp.body.errors).toBeDefined();
    expect(resp.body.errors).toHaveLength(1);
    const errors = resp.body.errors!;
    expect(errors[0]?.message).toBe(
      "field 'restrictedObject' not found in type: 'query_root'",
    );
    expect(error.message).toBe(
      "field 'restrictedObject' not found in type: 'query_root'",
    );
    expect(errors[0].extensions?.path).toBe("$.selectionSet.restrictedObject");
    expect(errors[0].extensions?.code).toBe("validation-failed");
  }
});

test("error handling for graphql as a generic error", async () => {
  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.graphql.request({
      query: `
        query GetRestrictedObject {
          restrictedObject {
            restrictedField
          }
        }
      `,
    });

    expect(true).toBe(false); // This should not be reached
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error; // Re-throw if it's not an Error
    }

    console.log("Error:", error.message);
    // Error: field 'restrictedObject' not found in type: 'query_root'

    expect(error.message).toBe(
      "field 'restrictedObject' not found in type: 'query_root'",
    );
  }
});
