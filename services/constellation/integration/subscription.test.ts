import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import WebSocket from "ws";

const GRAPHQL_WS_URL = "ws://localhost:8000/graphql";
const GRAPHQL_HTTP_URL = "http://localhost:8000/graphql";
const ADMIN_SECRET = "nhost-admin-secret";
const DB_URL = "postgresql://postgres:postgres@localhost:5432/local";

// Helper to make HTTP mutations
async function mutate(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(GRAPHQL_HTTP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": ADMIN_SECRET,
      "x-hasura-role": "admin",
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

// Helper to clean up test data
async function cleanupTestData() {
  // Delete test news entries
  await mutate(`
    mutation {
      delete_news(where: { title: { _like: "%TEST_SUBSCRIPTION%" } }) {
        affected_rows
      }
    }
  `);

  // Delete test kb_entry_departments first (foreign key)
  await mutate(`
    mutation {
      delete_kb_entry_departments(where: { kb_entry: { title: { _like: "%TEST_SUBSCRIPTION%" } } }) {
        affected_rows
      }
    }
  `);

  // Delete test kb_entries
  await mutate(`
    mutation {
      delete_kb_entries(where: { title: { _like: "%TEST_SUBSCRIPTION%" } }) {
        affected_rows
      }
    }
  `);
}

describe("GraphQL Subscriptions", () => {
  let client: ApolloClient;
  let wsClient: ReturnType<typeof createClient>;

  beforeAll(async () => {
    // Clean up any leftover test data
    await cleanupTestData();

    // Create WebSocket client
    wsClient = createClient({
      url: GRAPHQL_WS_URL,
      webSocketImpl: WebSocket,
      connectionParams: {
        headers: {
          "x-hasura-admin-secret": ADMIN_SECRET,
          "x-hasura-role": "admin",
        },
      },
    });

    // Create Apollo Client with WebSocket link
    const wsLink = new GraphQLWsLink(wsClient);

    client = new ApolloClient({
      link: wsLink,
      cache: new InMemoryCache(),
    });
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();

    // Close connections
    await wsClient.dispose();
    client.stop();
  });

  test(
    "news subscription receives inserted data",
    async () => {
      const receivedData: Array<{ title: string; content: string }[]> = [];

      const NEWS_SUBSCRIPTION = gql`
        subscription {
          news(order_by: { created_at: desc }, limit: 10) {
            title
            content
          }
        }
      `;

      // Start subscription
      console.log("Starting subscription...");
      const observable = client.subscribe({
        query: NEWS_SUBSCRIPTION,
      });

      // Wait for initial subscription data before inserting
      const initialDataPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for initial subscription data"));
        }, 5000);

        const sub = observable.subscribe({
          next: (result) => {
            console.log("Received initial result:", JSON.stringify(result, null, 2));
            clearTimeout(timeout);
            sub.unsubscribe();
            resolve();
          },
          error: (err) => {
            console.error("Initial subscription error:", err);
            clearTimeout(timeout);
            reject(err);
          },
        });
      });

      await initialDataPromise;
      console.log("Subscription established, inserting test data...");

      // Insert test data
      const insertResult = await mutate(`
        mutation {
          insert_news_one(object: {
            title: "TEST_SUBSCRIPTION_NEWS_1"
            content: "Test content for subscription"
            is_public: true
            author_id: "550e8400-e29b-41d4-a716-446655440001",
            department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
          }) {
            id
            title
          }
        }
      `);

      expect(insertResult.errors).toBeUndefined();
      expect(insertResult.data?.insert_news_one?.title).toBe("TEST_SUBSCRIPTION_NEWS_1");
      console.log("Insert successful, waiting for subscription update...");

      // Now subscribe again and wait for the inserted data
      const subscriptionPromise = new Promise<{ title: string; content: string }[]>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Subscription timeout - did not receive expected data"));
          }, 10000);

          const subscription = client.subscribe({ query: NEWS_SUBSCRIPTION }).subscribe({
            next: (result) => {
              console.log("Received update:", JSON.stringify(result, null, 2));
              if (result.data?.news) {
                receivedData.push(result.data.news);

                const hasTestData = result.data.news.some(
                  (n: { title: string }) => n.title === "TEST_SUBSCRIPTION_NEWS_1"
                );

                if (hasTestData) {
                  console.log("Found test data in subscription!");
                  clearTimeout(timeout);
                  subscription.unsubscribe();
                  resolve(result.data.news);
                }
              }
            },
            error: (err) => {
              console.error("Subscription error:", err);
              clearTimeout(timeout);
              reject(err);
            },
          });
        }
      );

      // Wait for subscription to receive the data
      const newsData = await subscriptionPromise;

      // Verify we received the data
      const testNews = newsData.find((n) => n.title === "TEST_SUBSCRIPTION_NEWS_1");
      expect(testNews).toBeDefined();
      expect(testNews?.content).toBe("Test content for subscription");
    },
    { timeout: 20000 }
  );

  test(
    "kb_entries subscription with nested departments receives inserted data",
    async () => {
      const KB_ENTRIES_SUBSCRIPTION = gql`
        subscription {
          kb_entries(order_by: { created_at: desc }, limit: 10) {
            title
            kb_entry_departments {
              department {
                name
              }
            }
          }
        }
      `;

      // Wait for initial subscription to establish
      console.log("Starting kb_entries subscription...");
      const initialDataPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for initial kb_entries data"));
        }, 5000);

        const sub = client.subscribe({ query: KB_ENTRIES_SUBSCRIPTION }).subscribe({
          next: (result) => {
            console.log("Received initial kb_entries data:", JSON.stringify(result, null, 2));
            clearTimeout(timeout);
            sub.unsubscribe();
            resolve();
          },
          error: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        });
      });

      await initialDataPromise;
      console.log("Subscription established, inserting test kb_entry...");

      // Insert test kb_entry
      const insertKbResult = await mutate(`
        mutation {
          insert_kb_entries_one(object: {
            title: "TEST_SUBSCRIPTION_KB_ENTRY_1"
            summary: "Test summary"
            content: "Test content for kb entry subscription"
            uploader_id: "550e8400-e29b-41d4-a716-446655440001"
          }) {
            id
            title
          }
        }
      `);

      expect(insertKbResult.errors).toBeUndefined();
      const kbEntryId = insertKbResult.data?.insert_kb_entries_one?.id;
      expect(kbEntryId).toBeDefined();
      console.log("KB entry inserted:", kbEntryId);

      // Insert kb_entry_department relationship
      const insertRelResult = await mutate(
        `
        mutation($kb_entry_id: uuid!) {
          insert_kb_entry_departments_one(object: {
            kb_entry_id: $kb_entry_id
            department_id: "2db9de0a-b9ba-416e-8619-783a399ae2b3"
          }) {
            id
          }
        }
      `,
        { kb_entry_id: kbEntryId }
      );

      expect(insertRelResult.errors).toBeUndefined();
      console.log("KB entry department relationship inserted");

      // Now subscribe and wait for the inserted data
      type KbEntry = {
        title: string;
        kb_entry_departments: Array<{ department: { name: string } }>;
      };

      const subscriptionPromise = new Promise<KbEntry[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Subscription timeout - did not receive expected kb_entries data"));
        }, 10000);

        const subscription = client.subscribe({ query: KB_ENTRIES_SUBSCRIPTION }).subscribe({
          next: (result) => {
            console.log("Received kb_entries update:", JSON.stringify(result, null, 2));
            if (result.data?.kb_entries) {
              const hasTestData = result.data.kb_entries.some(
                (e: { title: string }) => e.title === "TEST_SUBSCRIPTION_KB_ENTRY_1"
              );

              if (hasTestData) {
                console.log("Found test kb_entry in subscription!");
                clearTimeout(timeout);
                subscription.unsubscribe();
                resolve(result.data.kb_entries);
              }
            }
          },
          error: (err) => {
            console.error("Subscription error:", err);
            clearTimeout(timeout);
            reject(err);
          },
        });
      });

      // Wait for subscription to receive the data
      const kbData = await subscriptionPromise;

      // Verify we received the data with nested department
      const testEntry = kbData.find((e) => e.title === "TEST_SUBSCRIPTION_KB_ENTRY_1");
      expect(testEntry).toBeDefined();
      expect(testEntry?.kb_entry_departments).toBeDefined();
      expect(testEntry?.kb_entry_departments.length).toBeGreaterThan(0);
      expect(testEntry?.kb_entry_departments[0].department.name).toBe("Human Resources");
    },
    { timeout: 20000 }
  );
});
